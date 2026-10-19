/**
 * Cloudflare Worker: dezelfde Overwatch-bot, maar zonder altijd-aan proces.
 *
 *  - POST /interactions  Discord stuurt hier de slash commands naartoe
 *  - GET  /              simpele health-check
 *  - cron "0 7 * * *"    dagelijkse countdown-update (07:00 UTC = 09:00 in de zomer)
 *  - cron "0 3 * * 0"    wekelijkse sync van de seizoensdata naar KV
 *
 * Secrets (wrangler secret put): DISCORD_TOKEN, PUBLIC_KEY
 * Vars (wrangler.toml): APP_ID, TRACKER_CHANNEL_ID
 * KV-binding: DATA (optioneel; zonder KV wordt de meegebouwde seed gebruikt)
 */

import { commandDefinities, vindCommand, optiesVan } from '../shared/commands/index.js';
import { setDatasetLoader } from '../shared/lib/store.js';
import { trackerEmbed } from '../shared/lib/tracker.js';
import { sync } from '../shared/lib/sync.js';
import { verifieerDiscordVerzoek } from './lib/verify.js';
import { stuurFollowUp, werkTrackerBij } from './lib/rest.js';
import seed from './seed.js';

const CRON_SYNC = '0 3 * * SUN';
const CRON_TRACKER = '0 7 * * *';

// Discord wil binnen 3 seconden antwoord. Lukt de command sneller, dan sturen
// we het resultaat direct; anders antwoorden we "even bezig" en sturen we het
// resultaat als follow-up.
const SNELLE_GRENS_MS = 1800;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Zet de dataset-bron: KV als die er is, anders de meegebouwde seed-JSON. */
function zetDatasetBron(env) {
  setDatasetLoader(async () => {
    let uitKv = null;
    if (env.DATA) {
      try {
        uitKv = await env.DATA.get('seasons', 'json');
      } catch (err) {
        console.error('KV lezen mislukt:', err.message);
      }
    }
    // sleutel null = nooit cachen, zodat een sync direct zichtbaar is
    return { sleutel: null, data: uitKv ?? seed };
  });
}

function haalFocus(interaction) {
  const opties = interaction.data?.options ?? [];
  return String(opties.find((o) => o.focused)?.value ?? '');
}

/** Wekelijkse sync: wiki lezen, eventdatums van vorige keer behouden, naar KV. */
async function voerSyncUit(env) {
  console.log('Sync gestart...');
  const vorige = env.DATA ? await env.DATA.get('seasons', 'json').catch(() => null) : seed;
  // Geen eventpagina's: dat kost te veel tijd binnen een cron.
  const dataset = await sync({ metEvents: false, log: (regel) => console.log(regel) });
  behoudEventDatums(dataset, vorige ?? seed);
  if (env.DATA) await env.DATA.put('seasons', JSON.stringify(dataset));
  else console.log('WAARSCHUWING: KV-binding DATA ontbreekt; sync wordt niet bewaard.');
  return dataset;
}

/**
 * De cron-sync slaat de eventpagina's over (te veel tijd/CPU), waardoor
 * eventdatums zouden verdwijnen. Neem ze over uit de vorige dataset.
 */
function behoudEventDatums(nieuw, oud) {
  if (!oud?.seasons) return nieuw;
  const oudPerSleutel = new Map();
  for (const s of oud.seasons) {
    for (const e of s.events ?? []) {
      if (e.start) oudPerSleutel.set(`${s.index}|${e.naam}`, e);
    }
  }
  let overgenomen = 0;
  for (const s of nieuw.seasons) {
    for (const e of s.events ?? []) {
      const eerder = oudPerSleutel.get(`${s.index}|${e.naam}`);
      if (eerder && !e.start) {
        Object.assign(e, { start: eerder.start, end: eerder.end, precisie: eerder.precies });
        overgenomen++;
      }
    }
  }
  if (overgenomen) console.log(`${overgenomen} eventdatum(s) overgenomen uit de vorige dataset.`);
  return nieuw;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return json({
        status: 'ok',
        bot: 'Overwatch-bot',
        commands: commandDefinities().map((c) => c.name),
        kv: Boolean(env.DATA),
      });
    }

    if (request.method !== 'POST' || url.pathname !== '/interactions') {
      // Handmatige trigger, zodat je niet op de cron hoeft te wachten:
      //   curl -X POST "https://<worker>/cron?taak=tracker" -H "x-cron-sleutel: <CRON_SLEUTEL>"
      if (request.method === 'POST' && url.pathname === '/cron') {
        if (!env.CRON_SLEUTEL || request.headers.get('x-cron-sleutel') !== env.CRON_SLEUTEL) {
          return json({ fout: 'geen toegang' }, 401);
        }
        zetDatasetBron(env);
        const taak = url.searchParams.get('taak') ?? 'tracker';
        try {
          if (taak === 'sync') await voerSyncUit(env);
          await werkTrackerBij(env, await trackerEmbed());
          return json({ ok: true, taak });
        } catch (err) {
          return json({ fout: err.message }, 500);
        }
      }
      return new Response('Niet gevonden', { status: 404 });
    }

    const { ok, body, fout } = await verifieerDiscordVerzoek(request, env.PUBLIC_KEY);
    if (!ok) return new Response(`Ongeldige signature (${fout ?? 'verkeerde sleutel'})`, { status: 401 });

    let interaction;
    try {
      interaction = JSON.parse(body);
    } catch {
      return new Response('Ongeldige JSON', { status: 400 });
    }

    // 1 = PING (zo verifieert het Developer Portal de URL)
    if (interaction.type === 1) return json({ type: 1 });

    zetDatasetBron(env);

    // 4 = autocomplete: moet binnen 3 seconden antwoord hebben
    if (interaction.type === 4) {
      const command = vindCommand(interaction.data?.name);
      if (!command?.autocomplete) return json({ type: 8, data: { choices: [] } });
      const TE_LAAT = Symbol('te laat');
      const keuzes = await Promise.race([
        command.autocomplete({ focused: haalFocus(interaction) }).catch((err) => {
          console.error('Autocomplete mislukt:', err.message);
          return [];
        }),
        new Promise((r) => setTimeout(() => r(TE_LAAT), 2500)),
      ]);
      return json({ type: 8, data: { choices: keuzes === TE_LAAT ? [] : keuzes } });
    }

    // 2 = slash command
    if (interaction.type === 2) {
      const command = vindCommand(interaction.data?.name);
      if (!command) return json({ type: 4, data: { content: `Onbekende command: ${interaction.data?.name}` } });

      const werk = command.run({ opties: optiesVan(interaction) });
      const TE_LAAT = Symbol('te laat');
      const resultaat = await Promise.race([
        werk.catch((err) => ({ content: `Er ging iets mis: ${err.message}` })),
        new Promise((r) => setTimeout(() => r(TE_LAAT), SNELLE_GRENS_MS)),
      ]);

      if (resultaat !== TE_LAAT) return json({ type: 4, data: resultaat });

      // 5 = deferred: laat Discord weten dat er iets aankomt, en stuur het
      // resultaat daarna via de interaction-webhook.
      ctx.waitUntil(
        werk
          .then((payload) => stuurFollowUp(env, interaction, payload))
          .catch(async (err) => {
            console.error(`Command ${interaction.data?.name} mislukt:`, err.message);
            await stuurFollowUp(env, interaction, { content: `Er ging iets mis: ${err.message}` }).catch(() => {});
          }),
      );
      return json({ type: 5 });
    }

    return json({ type: 4, data: { content: 'Dit interactietype wordt niet ondersteund.' } });
  },

  async scheduled(event, env, ctx) {
    zetDatasetBron(env);

    ctx.waitUntil(
      (async () => {
        if (event.cron === CRON_SYNC) {
          try {
            await voerSyncUit(env);
          } catch (err) {
            console.error('Sync mislukt:', err.message);
          }
        }
        await werkTrackerBij(env, await trackerEmbed());
      })().catch((err) => console.error('Cron mislukt:', err.message)),
    );
  },
};

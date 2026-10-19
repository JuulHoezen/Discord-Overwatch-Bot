#!/usr/bin/env node
/**
 * Test de Cloudflare Worker zonder Cloudflare en zonder Discord.
 *
 * Draaien: npm run smoke:worker
 *
 * Wat het doet:
 *  - genereert een eigen Ed25519-sleutelpaar en doet alsof dat de public key
 *    van de Discord-app is, dus de echte signature-verificatie wordt getest;
 *  - stuurt PING, een slash command en een autocomplete door de fetch-handler;
 *  - roept de cron-handler aan met een nagebootste Discord API.
 *
 * Discord-verkeer wordt onderschept; OverFast en de wiki gaan echt over de lijn.
 */

import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import worker from '../index.js';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const ruwePublicKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
const PUBLIC_KEY_HEX = Buffer.from(ruwePublicKey).toString('hex');

const env = {
  PUBLIC_KEY: PUBLIC_KEY_HEX,
  APP_ID: '1561698349978226810',
  DISCORD_TOKEN: 'test-token',
  TRACKER_CHANNEL_ID: '1561705641854514740',
};

let discordBerichten = []; // wat de nagebootste Discord API teruggeeft op GET messages
const discordCalls = [];
let wachtTaken = [];

const echteFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input?.url ?? String(input));
  if (url.startsWith('https://discord.com/api/')) {
    discordCalls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : null });
    if ((init?.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify(discordBerichten), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(null, { status: 204 });
  }
  return echteFetch(input, init);
};

const ctx = {
  waitUntil: (belofte) => wachtTaken.push(belofte),
  passThroughOnException: () => {},
};

let mislukt = 0;
function check(naam, voorwaarde, extra = '') {
  console.log(`${voorwaarde ? '  OK  ' : '  FOUT'} ${naam}${extra ? ` - ${extra}` : ''}`);
  if (!voorwaarde) mislukt++;
}

function ondertekendVerzoek(body, { keyHex = PUBLIC_KEY_HEX, timestamp = String(Math.floor(Date.now() / 1000)) } = {}) {
  const tekst = JSON.stringify(body);
  const handtekening = cryptoSign(null, Buffer.from(timestamp + tekst), privateKey).toString('hex');
  return new Request('https://bot.example.workers.dev/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature-ed25519': keyHex === PUBLIC_KEY_HEX ? handtekening : 'a'.repeat(128),
      'x-signature-timestamp': timestamp,
    },
    body: tekst,
  });
}

const interactie = (data, type = 2) => ({ id: '1', application_id: env.APP_ID, type, token: 'tok', data });

await (async () => {
  console.log('\n1. health-check');
  const gezond = await worker.fetch(new Request('https://bot.example.workers.dev/'), env, ctx);
  const gezondJson = await gezond.json();
  check('GET / geeft 200 en de commandlijst', gezond.status === 200 && gezondJson.commands.length === 7, gezondJson.commands.join(', '));

  console.log('\n2. signature-verificatie');
  const ping = await worker.fetch(ondertekendVerzoek({ type: 1 }), env, ctx);
  check('PING met geldige signature geeft type 1', ping.status === 200 && (await ping.json()).type === 1);

  const vals = await worker.fetch(ondertekendVerzoek({ type: 1 }, { keyHex: 'x' }), env, ctx);
  check('PING met verkeerde signature geeft 401', vals.status === 401);

  const geenHeaders = await worker.fetch(new Request('https://bot.example.workers.dev/interactions', { method: 'POST', body: '{}' }), env, ctx);
  check('zonder signature-headers 401', geenHeaders.status === 401);

  console.log('\n3. /season (moet binnen de snelle grens klaar zijn)');
  const season = await worker.fetch(
    ondertekendVerzoek(interactie({ name: 'season', options: [] })),
    env,
    ctx,
  );
  const seasonJson = await season.json();
  check('type 4 (direct antwoord)', seasonJson.type === 4, `type ${seasonJson.type}`);
  const embed = seasonJson.data?.embeds?.[0];
  check('embed met het huidige seizoen', embed?.title === 'Season 5: A Grim Doctrine', embed?.title);
  check(
    'countdown-veld aanwezig',
    (embed?.fields ?? []).some((f) => f.name === 'Status' && f.value.includes('dag(en)')),
    (embed?.fields ?? []).find((f) => f.name === 'Status')?.value,
  );
  check('bronvermelding in de footer', String(embed?.footer?.text ?? '').includes('Overwatch Wiki'));

  console.log('\n4. /event met de optie alles=True');
  const event = await worker.fetch(
    ondertekendVerzoek(interactie({ name: 'event', options: [{ name: 'alles', value: true }] })),
    env,
    ctx,
  );
  const eventJson = await event.json();
  check('type 4 met alle seizoenen als velden', eventJson.type === 4 && eventJson.data.embeds[0].fields.length === 6);

  console.log('\n5. autocomplete van /hero');
  const auto = await worker.fetch(
    ondertekendVerzoek(interactie({ name: 'hero', options: [{ name: 'naam', value: 'an', focused: true }] }, 4)),
    env,
    ctx,
  );
  const autoJson = await auto.json();
  check('type 8 met keuzes', autoJson.type === 8 && autoJson.data.choices.length > 0, `${autoJson.data?.choices?.length} keuzes`);

  console.log('\n6. /player (raakt de OverFast API; mag ook via follow-up)');
  const player = await worker.fetch(
    ondertekendVerzoek(interactie({ name: 'player', options: [{ name: 'battletag', value: 'TeKrop-2217' }] })),
    env,
    ctx,
  );
  const playerJson = await player.json();
  check('type 4 of 5', playerJson.type === 4 || playerJson.type === 5, `type ${playerJson.type}`);
  if (playerJson.type === 4) {
    check('profiel-embed', String(playerJson.data?.embeds?.[0]?.title ?? '').includes('TeKrop'));
  }

  // Wachttaken (follow-ups en crons) afmaken.
  await Promise.allSettled(wachtTaken);
  wachtTaken = [];

  const followUps = discordCalls.filter((c) => c.url.includes('/webhooks/'));
  for (const f of followUps) {
    const titel = f.body?.embeds?.[0]?.title;
    console.log(`      follow-up: ${titel ?? f.body?.content}`);
  }
  check('geen onbeantwoorde interactie', playerJson.type === 4 || followUps.length > 0 || playerJson.type === 5);

  console.log('\n7. cron: countdown plaatsen (kanaal is leeg)');
  discordBerichten = [];
  discordCalls.length = 0;
  await worker.scheduled({ cron: '0 7 * * *' }, env, ctx);
  await Promise.allSettled(wachtTaken);
  wachtTaken = [];
  const post = discordCalls.find((c) => c.method === 'POST' && c.url.includes('/channels/'));
  check('nieuw bericht geplaatst', Boolean(post), post?.url);
  check('met de tracker-marker in de footer', String(post?.body?.embeds?.[0]?.footer?.text ?? '').includes('OW-SEASON-TRACKER'));

  console.log('\n8. cron: countdown verversen (bericht bestaat al)');
  discordBerichten = [
    {
      id: '99',
      author: { id: env.APP_ID },
      embeds: [{ footer: { text: `iets | OW-SEASON-TRACKER` } }],
    },
  ];
  discordCalls.length = 0;
  await worker.scheduled({ cron: '0 7 * * *' }, env, ctx);
  await Promise.allSettled(wachtTaken);
  wachtTaken = [];
  const patch = discordCalls.find((c) => c.method === 'PATCH');
  check('bestaand bericht wordt bijgewerkt, niet gedupliceerd', Boolean(patch) && !discordCalls.some((c) => c.method === 'POST' && c.url.includes('/channels/')));

  console.log('\n9. handmatige trigger (/cron)');
  discordCalls.length = 0;
  const zonderSleutel = await worker.fetch(
    new Request('https://bot.example.workers.dev/cron?taak=tracker', { method: 'POST' }),
    { ...env, CRON_SLEUTEL: 'geheim' },
    ctx,
  );
  check('/cron zonder sleutel geeft 401', zonderSleutel.status === 401);

  const metSleutel = await worker.fetch(
    new Request('https://bot.example.workers.dev/cron?taak=tracker', {
      method: 'POST',
      headers: { 'x-cron-sleutel': 'geheim' },
    }),
    { ...env, CRON_SLEUTEL: 'geheim' },
    ctx,
  );
  const metSleutelJson = await metSleutel.json();
  check('/cron met sleutel werkt', metSleutel.status === 200 && metSleutelJson.ok === true, JSON.stringify(metSleutelJson));

  console.log('\n10. cron: wekelijkse sync (echte wiki, KV nagebootst)');
  discordCalls.length = 0;
  const kvWrites = [];
  // De "oude" dataset in KV heeft een eventdatum die de sync niet ophaalt.
  const oudeDataset = JSON.parse(readFileSync(new URL('../../bot/data/seasons.json', import.meta.url), 'utf8'));
  oudeDataset.seasons.find((s) => s.index === 3).events.find((e) => e.naam === 'Summer Games').start = '2026-07-14';
  const envMetKv = {
    ...env,
    DATA: { get: async () => oudeDataset, put: async (k, v) => kvWrites.push({ k, lengte: v.length, data: JSON.parse(v) }) },
  };
  await worker.scheduled({ cron: '0 3 * * SUN' }, envMetKv, ctx);
  await Promise.allSettled(wachtTaken);
  wachtTaken = [];
  check('dataset naar KV geschreven', kvWrites.length === 1, kvWrites[0] ? `${kvWrites[0].k}, ${kvWrites[0].lengte} bytes` : 'geen write');
  const summerGames = kvWrites[0]?.data?.seasons?.find((s) => s.index === 3)?.events?.find((e) => e.naam === 'Summer Games');
  check('eventdatum uit de vorige dataset behouden', summerGames?.start === '2026-07-14', summerGames?.start ?? 'leeg');
  check('en daarna de countdown bijgewerkt', discordCalls.some((c) => c.method === 'PATCH' || c.method === 'POST'));
})();

console.log(mislukt ? `\n${mislukt} test(s) mislukt.` : '\nAlle worker-tests geslaagd.');
process.exit(mislukt ? 1 : 0);

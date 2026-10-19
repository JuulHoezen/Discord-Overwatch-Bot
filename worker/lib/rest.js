/**
 * Dun laagje over de Discord REST API voor de Worker: follow-up-berichten en
 * het bijwerken van het countdown-bericht. Alleen fetch, geen discord.js.
 */

import { TRACKER_MARKER } from '../../shared/lib/embed.js';

const API = 'https://discord.com/api/v10';

async function discord(env, pad, init = {}) {
  const res = await fetch(API + pad, {
    ...init,
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': '1KEY-OverwatchBot/1.0',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const tekst = await res.text().catch(() => '');
    throw new Error(`Discord API gaf HTTP ${res.status} op ${pad}${tekst ? `: ${tekst.slice(0, 200)}` : ''}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Antwoord op een interaction waar we eerst "even bezig" op hebben geantwoord. */
export async function stuurFollowUp(env, interaction, payload) {
  return discord(env, `/webhooks/${env.APP_ID}/${interaction.token}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Plaatst of ververs het countdown-bericht in TRACKER_CHANNEL_ID. */
export async function werkTrackerBij(env, embed) {
  const kanaal = env.TRACKER_CHANNEL_ID;
  if (!kanaal) {
    console.log('TRACKER_CHANNEL_ID niet gezet: countdown overgeslagen.');
    return;
  }

  const berichten = await discord(env, `/channels/${kanaal}/messages?limit=50`);
  const bestaand = berichten.find(
    (m) =>
      m.author?.id === env.APP_ID &&
      (m.embeds ?? []).some((e) => (e.footer?.text ?? '').includes(TRACKER_MARKER)),
  );

  if (bestaand) {
    await discord(env, `/channels/${kanaal}/messages/${bestaand.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: '', embeds: [embed] }),
    });
    console.log('Countdown bijgewerkt.');
  } else {
    await discord(env, `/channels/${kanaal}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: 'Seizoenscountdown (wordt dagelijks automatisch bijgewerkt)', embeds: [embed] }),
    });
    console.log('Countdown geplaatst.');
  }
}

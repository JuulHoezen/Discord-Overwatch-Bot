#!/usr/bin/env node
/**
 * Drukt af in welke servers de bot zit en welke tekstkanalen je kunt gebruiken,
 * inclusief de ID's die in .env moeten (DISCORD_GUILD_ID, TRACKER_CHANNEL_ID).
 *
 * Draaien: npm run whereami
 *
 * Gebruikt alleen de REST API met het bot-token; de bot hoeft hiervoor niet
 * via de Gateway verbonden te zijn.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const HIER = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(HIER, '..', '..', '.env') });

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('DISCORD_TOKEN ontbreekt in .env.');
  process.exit(1);
}

const KANAALTYPES = { 0: 'tekst', 2: 'spraak', 4: 'categorie', 5: 'aankondiging', 15: 'forum', 16: 'media' };

async function api(pad) {
  const res = await fetch('https://discord.com/api/v10' + pad, {
    headers: { Authorization: `Bot ${TOKEN}`, 'User-Agent': '1KEY-OverwatchBot/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} op ${pad}`);
  return res.json();
}

try {
  const ik = await api('/users/@me');
  console.log(`Bot: ${ik.username} (id ${ik.id})\n`);

  const guilds = await api('/users/@me/guilds?limit=200');
  if (!guilds.length) {
    console.log('De bot zit nog in geen enkele server.');
    console.log('Nodig hem eerst uit via het Developer Portal > Installation, of met:');
    console.log(
      `  https://discord.com/oauth2/authorize?client_id=${ik.id}&scope=bot+applications.commands&permissions=84992`,
    );
    process.exit(0);
  }

  console.log(`De bot zit in ${guilds.length} server(s):\n`);
  for (const g of guilds) {
    console.log(`  ${g.name}`);
    console.log(`  DISCORD_GUILD_ID=${g.id}`);
    let kanalen = [];
    try {
      kanalen = (await api(`/guilds/${g.id}/channels`))
        .filter((k) => [0, 5, 15, 16].includes(k.type))
        .sort((a, b) => a.position - b.position);
    } catch {
      console.log('    (kanalen ophalen mislukt: bot mist de permissie View Channels)');
    }
    for (const k of kanalen) {
      console.log(`    #${k.name}  (${KANAALTYPES[k.type] ?? k.type})  TRACKER_CHANNEL_ID=${k.id}`);
    }
    console.log('');
  }

  console.log('Zet de gewenste regels in .env en daarna:');
  console.log('  npm run deploy    (commands direct zichtbaar op die server)');
  console.log('  npm run bot       (bot starten)');
} catch (err) {
  console.error('Ophalen mislukt:', err.message);
  process.exit(1);
}

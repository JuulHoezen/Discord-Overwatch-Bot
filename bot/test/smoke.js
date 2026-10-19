#!/usr/bin/env node
/**
 * Rooktest: draait alle commands zonder Discord.
 *
 * Draaien: npm run smoke
 *
 * Test de gedeelde command-laag (shared/) die zowel de Gateway-bot als de
 * Cloudflare Worker gebruiken: dataset, OverFast API en de embed-opbouw.
 * Discord-rechten en kanaaltoegang test je alleen in een echte server.
 */

import { COMMANDS, optiesVan } from '../../shared/commands/index.js';
import { gebruikBestandsdataset } from '../node-store.js';

gebruikBestandsdataset();

let mislukt = 0;

const TEST_OPTIES = {
  season: {},
  seasons: {},
  event: { alles: true },
  hero: { naam: 'ana' },
  map: { naam: 'ilios' },
  player: { battletag: 'TeKrop-2217' },
  owstatus: {},
};

function toonPayload(payload) {
  if (!payload) {
    console.log('  GEEN PAYLOAD');
    mislukt++;
    return;
  }
  if (payload.content) console.log(`  tekst: ${String(payload.content).split('\n')[0].slice(0, 150)}`);
  for (const embed of payload.embeds ?? []) {
    console.log(`  embed: "${embed.title ?? '-'}"`);
    if (embed.description) {
      console.log(`      beschrijving: ${String(embed.description).replace(/\n/g, ' | ').slice(0, 140)}`);
    }
    for (const veld of embed.fields ?? []) {
      console.log(`      ${veld.name}: ${String(veld.value).replace(/\n/g, ' | ').slice(0, 120)}`);
    }
    if (embed.footer?.text) console.log(`      footer: ${embed.footer.text}`);
  }
}

for (const command of COMMANDS) {
  const naam = command.definition.name;
  console.log(`\n/${naam}`);

  try {
    if (command.autocomplete) {
      const keuzes = await command.autocomplete({ focused: 'an' });
      console.log(`  autocomplete: ${keuzes.length} keuzes, bv. ${keuzes[0]?.name ?? '-'}`);
    }
    toonPayload(await command.run({ opties: TEST_OPTIES[naam] ?? {} }));
  } catch (err) {
    console.log(`  FOUT: ${err.message}`);
    mislukt++;
  }
}

// De interactie-laag van de Worker: opties uit Discord-JSON halen.
const voorbeeld = { data: { options: [{ name: 'nummer', value: 3 }] } };
const geparsed = optiesVan(voorbeeld);
console.log(`\noptiesVan: ${JSON.stringify(geparsed)} ${geparsed.nummer === 3 ? 'OK' : 'FOUT'}`);
if (geparsed.nummer !== 3) mislukt++;

console.log(mislukt ? `\n${mislukt} onderdeel(en) mislukt.` : '\nAlle commands gaven een antwoord.');
process.exit(mislukt ? 1 : 0);

#!/usr/bin/env node
/**
 * Rooktest: draait alle commands met een nep-interaction, zonder Discord.
 *
 * Draaien: npm run smoke
 *
 * Zo controleren we de data-laag (seizoensdataset, OverFast API, embeds)
 * voordat de bot online gaat. Discord-specifieke rechten en kanaaltoegang
 * test je alleen in een echte server.
 */

import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const COMMAND_MAP = path.join(HIER, '..', 'commands');

let mislukt = 0;

function nepInteraction({ integers = {}, strings = {}, booleans = {}, focused = '' } = {}) {
  const uit = [];
  return {
    uit,
    options: {
      getInteger: (n) => integers[n] ?? null,
      getString: (n) => strings[n] ?? null,
      getBoolean: (n) => booleans[n] ?? null,
      getFocused: () => focused,
    },
    editReply: async (payload) => {
      uit.push(payload);
      return payload;
    },
    reply: async (payload) => {
      uit.push(payload);
      return payload;
    },
    respond: async (choices) => {
      uit.push({ choices });
    },
  };
}

function toon(naam, interaction) {
  const payload = interaction.uit.at(-1);
  if (!payload) {
    console.log(`  ${naam}: GEEN ANTWOORD`);
    mislukt++;
    return;
  }
  if (payload.choices) {
    console.log(`  ${naam}: ${payload.choices.length} autocomplete-keuzes, bv. ${payload.choices[0]?.name ?? '-'}`);
    return;
  }
  const embed = payload.embeds?.[0]?.data;
  if (payload.content) console.log(`  ${naam} tekst: ${String(payload.content).split('\n')[0].slice(0, 140)}`);
  if (embed) {
    console.log(`  ${naam} embed: "${embed.title ?? '-'}"`);
    for (const veld of embed.fields ?? []) {
      console.log(`      ${veld.name}: ${String(veld.value).replace(/\n/g, ' | ').slice(0, 120)}`);
    }
  }
}

const bestanden = (await readdir(COMMAND_MAP)).filter((f) => f.endsWith('.js'));
for (const bestand of bestanden) {
  const naam = bestand.replace('.js', '');
  const module = await import(pathToFileURL(path.join(COMMAND_MAP, bestand)).href);
  console.log(`\n/${naam}`);

  try {
    if (module.autocomplete) {
      const i = nepInteraction({ focused: 'an' });
      await module.autocomplete(i);
      toon('autocomplete', i);
    }
    const args = {
      season: {},
      seasons: {},
      event: { booleans: { alles: true } },
      hero: { strings: { naam: 'ana' } },
      map: { strings: { naam: 'ilios' } },
      player: { strings: { battletag: 'TeKrop-2217' } },
      owstatus: {},
    }[naam] ?? {};
    const i = nepInteraction(args);
    await module.execute(i);
    toon('execute', i);
  } catch (err) {
    console.log(`  FOUT: ${err.message}`);
    mislukt++;
  }
}

console.log(mislukt ? `\n${mislukt} onderdeel(en) mislukt.` : '\nAlle commands gaven een antwoord.');
process.exit(mislukt ? 1 : 0);

#!/usr/bin/env node
/**
 * Registreert de slash commands bij Discord.
 *
 * Draaien: npm run deploy
 *
 * Met DISCORD_GUILD_ID in .env worden de commands op die ene server gezet
 * (direct zichtbaar). Zonder dat ID worden ze globaal geregistreerd, wat tot
 * een uur kan duren voor ze verschijnen.
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));

// .env expliciet naast package.json zoeken, niet in de map waar je toevallig staat.
dotenv.config({ path: path.join(HIER, '..', '.env') });
const APP_ID = process.env.APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID || null;
const TOKEN = process.env.DISCORD_TOKEN;

if (!APP_ID || !TOKEN) {
  console.error('APP_ID en DISCORD_TOKEN zijn verplicht (zie .env.sample).');
  process.exit(1);
}

const bestanden = (await readdir(path.join(HIER, 'commands'))).filter((f) => f.endsWith('.js'));
const commands = [];
for (const bestand of bestanden) {
  const module = await import(pathToFileURL(path.join(HIER, 'commands', bestand)).href);
  if (module.data?.toJSON) commands.push(module.data.toJSON());
}

const rest = new REST().setToken(TOKEN);

try {
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(APP_ID, GUILD_ID)
    : Routes.applicationCommands(APP_ID);
  const resultaat = await rest.put(route, { body: commands });
  console.log(`${resultaat.length} commands geregistreerd ${GUILD_ID ? `op guild ${GUILD_ID}` : 'globaal'}:`);
  for (const c of resultaat) console.log(`  /${c.name} - ${c.description}`);
} catch (err) {
  console.error('Registreren mislukt:', err.message);
  process.exit(1);
}

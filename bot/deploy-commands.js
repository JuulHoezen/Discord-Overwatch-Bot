#!/usr/bin/env node
/**
 * Registreert de slash commands bij Discord (platte JSON uit shared/commands).
 *
 * Draaien: npm run deploy
 *
 * Met DISCORD_GUILD_ID in .env komen de commands op die ene server (direct
 * zichtbaar). Zonder dat ID worden ze globaal geregistreerd, wat tot een uur
 * kan duren. Voor de Cloudflare-versie is dit niet nodig zolang je dezelfde
 * app gebruikt: de commands staan dan al geregistreerd.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { commandDefinities } from '../shared/commands/index.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(HIER, '..', '.env') });

const APP_ID = process.env.APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID || null;
const TOKEN = process.env.DISCORD_TOKEN;

if (!APP_ID || !TOKEN) {
  console.error('APP_ID en DISCORD_TOKEN zijn verplicht (zie .env.sample).');
  process.exit(1);
}

const commands = commandDefinities();
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

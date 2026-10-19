/**
 * Overwatch-bot via de Discord Gateway (discord.js).
 *
 * Draaien: npm run bot
 *
 * Deze variant houdt zelf een verbinding met Discord open en moet dus ergens
 * aan blijven staan. De Cloudflare Worker (worker/index.js) gebruikt exact
 * dezelfde command-code maar dan via HTTP-interactions.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { COMMANDS, vindCommand, optiesVan } from '../shared/commands/index.js';
import { trackerEmbed, TRACKER_MARKER } from '../shared/lib/tracker.js';
import { gebruikBestandsdataset } from './node-store.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));

// .env expliciet naast package.json zoeken, zodat de bot ook werkt als hij
// vanuit een andere map wordt gestart (Taakplanner, PM2, systemd).
dotenv.config({ path: path.join(HIER, '..', '.env') });

gebruikBestandsdataset();

const TRACKER_CHANNEL_ID = process.env.TRACKER_CHANNEL_ID || null;
const TRACKER_UUR = Number(process.env.TRACKER_UUR ?? 9); // lokale tijd

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN ontbreekt. Zet die in .env (zie .env.sample).');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`Ingelogd als ${c.user.tag} met ${COMMANDS.length} commands: ${COMMANDS.map((x) => x.definition.name).join(', ')}`);
  if (TRACKER_CHANNEL_ID) {
    await updateTracker(c).catch((err) => console.error('Tracker bijwerken mislukt:', err.message));
    planDagelijkseTracker(c);
  } else {
    console.log('TRACKER_CHANNEL_ID niet gezet: automatische countdown-post staat uit.');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = vindCommand(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await interaction.respond(await command.autocomplete({ focused: interaction.options.getFocused() }));
    } catch (err) {
      console.error(`Autocomplete ${interaction.commandName} mislukt:`, err.message);
      await interaction.respond([]).catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const command = vindCommand(interaction.commandName);
  if (!command) return;

  try {
    await interaction.deferReply();
    await interaction.editReply(await command.run({ opties: optiesVan(interaction) }));
  } catch (err) {
    console.error(`Command ${interaction.commandName} mislukt:`, err);
    const bericht = `Er ging iets mis: ${err.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: bericht, embeds: [] }).catch(() => {});
    } else {
      await interaction.reply({ content: bericht, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

// ------------------------------------------------------------- tracker

async function updateTracker(c) {
  const kanaal = await c.channels.fetch(TRACKER_CHANNEL_ID).catch(() => null);
  if (!kanaal?.isTextBased()) throw new Error(`Kanaal ${TRACKER_CHANNEL_ID} niet gevonden of geen tekstkanaal`);

  const embed = await trackerEmbed();
  const berichten = await kanaal.messages.fetch({ limit: 50 });
  const bestaand = berichten.find(
    (m) => m.author.id === c.user.id && m.embeds.some((e) => (e.footer?.text ?? '').includes(TRACKER_MARKER)),
  );

  if (bestaand) {
    await bestaand.edit({ content: '', embeds: [embed] });
    console.log(`Countdown bijgewerkt in #${kanaal.name ?? TRACKER_CHANNEL_ID}.`);
  } else {
    await kanaal.send({ content: 'Seizoenscountdown (wordt dagelijks automatisch bijgewerkt)', embeds: [embed] });
    console.log(`Countdown geplaatst in #${kanaal.name ?? TRACKER_CHANNEL_ID}.`);
  }
}

function msTotVolgendUur(uur) {
  const nu = new Date();
  const doel = new Date(nu);
  doel.setHours(uur, 0, 0, 0);
  if (doel <= nu) doel.setDate(doel.getDate() + 1);
  return doel - nu;
}

function planDagelijkseTracker(c) {
  const wacht = msTotVolgendUur(TRACKER_UUR);
  console.log(`Volgende countdown-update over ${Math.round(wacht / 60000)} minuten.`);
  setTimeout(async () => {
    await updateTracker(c).catch((err) => console.error('Tracker bijwerken mislukt:', err.message));
    setInterval(
      () => updateTracker(c).catch((err) => console.error('Tracker bijwerken mislukt:', err.message)),
      24 * 60 * 60 * 1000,
    );
  }, wacht);
}

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error(
    `Inloggen mislukt: ${err.message}` +
      (err.code === 'TokenInvalid' ? ' - controleer DISCORD_TOKEN in .env (en of de token nog geldig is).' : ''),
  );
  process.exit(1);
});

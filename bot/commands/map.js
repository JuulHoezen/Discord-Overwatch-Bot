import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGamemodes, getMaps, resolveMap } from '../lib/overfast.js';
import { KLEUR } from '../lib/embed.js';

export const data = new SlashCommandBuilder()
  .setName('map')
  .setDescription('Overwatch-map: gamemode, locatie en afbeelding (via OverFast API)')
  .addStringOption((o) =>
    o.setName('naam').setDescription('Naam van de map').setRequired(true).setAutocomplete(true),
  );

export async function autocomplete(interaction) {
  const invoer = (interaction.options.getFocused() || '').toLowerCase();
  const maps = await getMaps();
  return interaction.respond(
    maps
      .filter((m) => m.name.toLowerCase().includes(invoer) || m.key.includes(invoer))
      .slice(0, 25)
      .map((m) => ({ name: `${m.name} (${m.gamemodes.join(', ')})`, value: m.key })),
  );
}

export async function execute(interaction) {
  const naam = interaction.options.getString('naam');
  const map = await resolveMap(naam);
  if (!map) return interaction.editReply(`Geen map gevonden voor "${naam}".`);

  const gamemodes = await getGamemodes();
  const namen = map.gamemodes.map((key) => gamemodes.find((g) => g.key === key)?.name ?? key);

  const embed = new EmbedBuilder()
    .setColor(KLEUR)
    .setTitle(map.name)
    .setImage(map.screenshot ?? null)
    .addFields(
      { name: 'Gamemode', value: namen.join(', ') || 'onbekend', inline: true },
      { name: 'Locatie', value: map.location ? `${map.location}${map.country_code ? ` (${map.country_code})` : ''}` : 'onbekend', inline: true },
      { name: 'Types', value: (map.uses ?? []).join(', ') || 'onbekend', inline: true },
    )
    .setFooter({ text: 'Bron: OverFast API (community-scrape van Blizzard-data)' });

  return interaction.editReply({ embeds: [embed] });
}

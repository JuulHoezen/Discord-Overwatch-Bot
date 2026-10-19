import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getHero, getHeroes, resolveHero } from '../lib/overfast.js';
import { KLEUR } from '../lib/embed.js';

export const data = new SlashCommandBuilder()
  .setName('hero')
  .setDescription('Overwatch-hero: rol, hitpoints en abilities (via OverFast API)')
  .addStringOption((o) =>
    o.setName('naam').setDescription('Naam van de hero').setRequired(true).setAutocomplete(true),
  );

const ROLLEN = { tank: 'Tank', damage: 'Damage', support: 'Support' };

export async function autocomplete(interaction) {
  const invoer = (interaction.options.getFocused() || '').toLowerCase();
  const heroes = await getHeroes();
  const keuzes = heroes
    .filter((h) => h.name.toLowerCase().includes(invoer) || h.key.includes(invoer))
    .slice(0, 25)
    .map((h) => ({ name: `${h.name} (${ROLLEN[h.role] ?? h.role})`, value: h.key }));
  return interaction.respond(keuzes);
}

export async function execute(interaction) {
  const naam = interaction.options.getString('naam');
  const basis = await resolveHero(naam);
  if (!basis) {
    return interaction.editReply(`Geen hero gevonden voor "${naam}".`);
  }

  const hero = await getHero(basis.key);
  const hp = hero.hitpoints
    ? [hero.hitpoints.health && `${hero.hitpoints.health} health`, hero.hitpoints.armor && `${hero.hitpoints.armor} armor`, hero.hitpoints.shields && `${hero.hitpoints.shields} shields`, `totaal ${hero.hitpoints.total}`]
        .filter(Boolean)
        .join(', ')
    : 'onbekend';

  const embed = new EmbedBuilder()
    .setColor(KLEUR)
    .setTitle(hero.name ?? basis.name)
    .setThumbnail(basis.portrait)
    .addFields(
      { name: 'Rol', value: ROLLEN[hero.role] ?? hero.role ?? 'onbekend', inline: true },
      { name: 'Subrol', value: hero.subrole ?? 'geen', inline: true },
      { name: 'Hitpoints', value: hp, inline: true },
    );

  if (hero.abilities?.length) {
    embed.addFields({
      name: 'Abilities',
      value: hero.abilities
        .slice(0, 6)
        .map((a) => `**${a.name}** - ${(a.description ?? '').split('.')[0]}`)
        .join('\n'),
    });
  }
  if (hero.perks?.length) {
    embed.addFields({
      name: 'Perks',
      value: hero.perks.map((p) => p.name ?? p).slice(0, 4).join(', '),
    });
  }

  embed.setFooter({ text: 'Bron: OverFast API (community-scrape van Blizzard-data)' });
  return interaction.editReply({ embeds: [embed] });
}

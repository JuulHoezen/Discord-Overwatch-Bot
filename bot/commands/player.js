import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { searchPlayer, getPlayer } from '../lib/overfast.js';
import { KLEUR } from '../lib/embed.js';
import { seizoenOpNummer } from '../lib/season.js';
import { duurNL } from '../lib/format.js';

export const data = new SlashCommandBuilder()
  .setName('player')
  .setDescription('Overwatch-spelerprofiel en ranks (via OverFast API)')
  .addStringOption((o) =>
    o
      .setName('battletag')
      .setDescription('BattleTag of spelersnaam, bv. Naam-1234')
      .setRequired(true),
  );

const ROLLEN = { tank: 'Tank', damage: 'Damage', support: 'Support', open: 'Open Queue' };
const DIVISIES = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'emerald', 'champion'];

function rankTekst(rank) {
  if (!rank) return 'geen rank bekend';
  const divisie = DIVISIES.includes(rank.division) ? rank.division : rank.division;
  return `${divisie} ${rank.tier}`;
}

export async function execute(interaction) {
  const ingevoerd = interaction.options.getString('battletag').trim();
  const gevonden = await searchPlayer(ingevoerd);

  if (!gevonden.total) {
    return interaction.editReply(
      `Geen speler gevonden voor "${ingevoerd}". Let op: de BattleTag moet bestaan en het Blizzard-profiel moet openbaar ("Public") staan; anders kan de OverFast API er niets van zien.`,
    );
  }

  const exact = gevonden.results.find((r) => r.player_id.toLowerCase() === ingevoerd.toLowerCase());
  const speler = exact ?? gevonden.results[0];
  const s = await getPlayer(speler.player_id);

  const embed = new EmbedBuilder()
    .setColor(KLEUR)
    .setTitle(`${s.username}${s.title ? ` - ${s.title}` : ''}`)
    .setThumbnail(s.avatar ?? null);

  if (s.endorsement?.level != null) {
    embed.addFields({ name: 'Endorsement', value: `level ${s.endorsement.level}`, inline: true });
  }

  const platform = s.competitive?.pc ? 'pc' : s.competitive?.console ? 'console' : null;
  const comp = platform ? s.competitive[platform] : null;

  if (comp) {
    const profielSeizoen = comp.season;
    const arcIndex = Number.isFinite(profielSeizoen) ? profielSeizoen - 20 : null;
    const arcSeizoen = arcIndex ? await seizoenOpNummer(arcIndex) : null;

    embed.addFields({
      name: `Competitive (${platform})`,
      value: Object.entries(comp)
        .filter(([k]) => ROLLEN[k])
        .map(([k, v]) => `${ROLLEN[k]}: ${rankTekst(v)}`)
        .join('\n'),
    });

    if (profielSeizoen != null) {
      const toelichting = arcSeizoen
        ? `komt overeen met ${arcSeizoen.title} in de arc (afgeleid: Blizzard-nummer - 20)`
        : 'seizoensnummer uit het Blizzard-profiel; geen overeenkomstig arc-seizoen in de dataset gevonden (afgeleid)';
      embed.addFields({ name: 'Seizoen volgens profiel', value: `seizoen ${profielSeizoen} - ${toelichting}` });
    }
  } else {
    embed.addFields({ name: 'Competitive', value: 'geen competitive-gegevens in het profiel' });
  }

  if (s.last_updated_at) {
    const ms = Date.now() - s.last_updated_at * 1000;
    embed.setFooter({
      text: `Bron: OverFast API - profieldata van Blizzard, bijgewerkt ${duurNL(ms)} geleden (kan verouderd zijn)`,
    });
  } else {
    embed.setFooter({ text: 'Bron: OverFast API - profieldata van Blizzard' });
  }

  return interaction.editReply({ embeds: [embed] });
}

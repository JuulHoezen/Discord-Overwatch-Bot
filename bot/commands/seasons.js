import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { laadSeizoenen, seizoenStatus } from '../lib/season.js';
import { KLEUR, bronVoet, statusTekst, startLabel, eindLabel } from '../lib/embed.js';

export const data = new SlashCommandBuilder()
  .setName('seasons')
  .setDescription('Alle seizoenen van de huidige Overwatch-arc met looptijd en status');

export async function execute(interaction) {
  const dataset = await laadSeizoenen();
  const nu = new Date();

  const embed = new EmbedBuilder()
    .setColor(KLEUR)
    .setTitle(`${dataset.arc.name} - seizoenen ${dataset.arc.year}`)
    .setDescription(
      dataset.seasons
        .map((s) => {
          const status = seizoenStatus(s, nu);
          const markering = status.dagenTotStart <= 0 && status.dagenTotEind >= 0 ? ' <- nu' : '';
          return `**${s.title}**\n${startLabel(s)} t/m ${eindLabel(s)} - ${statusTekst(status)}${markering}`;
        })
        .join('\n\n'),
    )
    .setFooter({ text: bronVoet(dataset) });

  return interaction.editReply({ embeds: [embed] });
}

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { huidigSeizoen, seizoenOpNummer } from '../lib/season.js';
import { KLEUR, bronVoet, eventsTekst, startLabel, eindLabel } from '../lib/embed.js';

export const data = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Overwatch-events: welke events horen bij welk seizoen')
  .addIntegerOption((o) =>
    o.setName('seizoen').setDescription('Seizoensnummer binnen de huidige arc').setMinValue(1).setMaxValue(30),
  )
  .addBooleanOption((o) =>
    o.setName('alles').setDescription('Toon de events van alle seizoenen in de arc'),
  );

export async function execute(interaction) {
  const nummer = interaction.options.getInteger('seizoen');
  const alles = interaction.options.getBoolean('alles') ?? false;
  const { huidig, data: dataset } = await huidigSeizoen();

  const teTonen = alles
    ? dataset.seasons
    : [nummer ? await seizoenOpNummer(nummer) : huidig].filter(Boolean);

  if (!teTonen.length) {
    return interaction.editReply(
      `Geen seizoen gevonden voor nummer ${nummer}. De dataset bevat seizoen 1 t/m ${dataset.seasons.length}.`,
    );
  }

  if (!alles && !teTonen[0].events?.length) {
    const s = teTonen[0];
    return interaction.editReply(
      `Voor **${s.title}** vermeldt de bron nog geen events.\n` +
        `Dit seizoen loopt van ${startLabel(s)} tot ${eindLabel(s)}${s.end_precision === 'month' ? '' : ''}.\n\n` +
        'Gebruik `/event alles:True` voor de events van alle seizoenen in deze arc. ' +
        'Let op: de Overwatch Wiki publiceert lang niet voor elk event een datum; waar die ontbreekt zegt de bot dat erbij.',
    );
  }

  const embed = new EmbedBuilder()
    .setColor(KLEUR)
    .setTitle(alles ? `${dataset.arc.name} - alle events` : `Events in ${teTonen[0].title}`)
    .setFooter({ text: bronVoet(dataset, { extra: 'eventdatums zijn vaak niet gepubliceerd' }) });

  if (alles) {
    for (const s of teTonen) {
      embed.addFields({
        name: s.title,
        value: s.events?.length
          ? eventsTekst(s.events)
          : `geen events vermeld (seizoen loopt ${startLabel(s)} t/m ${eindLabel(s)})`,
      });
    }
  } else {
    embed.setDescription(eventsTekst(teTonen[0].events));
  }

  return interaction.editReply({ embeds: [embed] });
}

import { SlashCommandBuilder } from 'discord.js';
import { huidigSeizoen, seizoenOpNummer } from '../lib/season.js';
import { seizoenEmbed, bronVoet, startLabel } from '../lib/embed.js';
import { datumNL } from '../lib/format.js';

export const data = new SlashCommandBuilder()
  .setName('season')
  .setDescription('Overwatch-seizoen: looptijd, countdown tot het einde en inhoud')
  .addIntegerOption((o) =>
    o
      .setName('nummer')
      .setDescription('Seizoensnummer binnen de huidige arc (1 = eerste seizoen van de arc)')
      .setMinValue(1)
      .setMaxValue(30),
  );

export async function execute(interaction) {
  const nummer = interaction.options.getInteger('nummer');
  const { huidig, volgende, inVenster, data: dataset } = await huidigSeizoen();
  const seizoen = nummer ? await seizoenOpNummer(nummer) : huidig;

  if (!seizoen) {
    return interaction.editReply(
      `Geen seizoen gevonden voor nummer ${nummer ?? '(huidig)'}. De dataset bevat seizoen 1 t/m ${dataset.seasons.length} van de arc "${dataset.arc.name}".`,
    );
  }

  const embed = seizoenEmbed(seizoen, {
    bron: bronVoet(dataset),
    totaal: dataset.seasons.length,
  });

  const opmerkingen = [];
  if (!inVenster) {
    opmerkingen.push(
      `Let op: de dataset is gesynct op ${dataset.generated_at.slice(0, 10)} en heeft geen venster dat ${datumNL(new Date().toISOString().slice(0, 10))} dekt. Sync opnieuw met \`npm run sync\`.`,
    );
  }
  if (!nummer && volgende) {
    opmerkingen.push(`Volgende: **${volgende.title}**, begint ${startLabel(volgende)}.`);
  }
  if (seizoen.end_precision === 'month') {
    opmerkingen.push(
      'De bron noemt voor dit seizoen alleen een maand als einddatum; de countdown rekent met de laatste dag van die maand en is dus een bovengrens.',
    );
  }

  return interaction.editReply({ content: opmerkingen.join('\n') || null, embeds: [embed] });
}

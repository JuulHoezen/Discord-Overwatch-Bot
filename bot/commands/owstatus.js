import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { datasetInfo } from '../lib/store.js';
import { huidigSeizoen, seizoenStatus } from '../lib/season.js';
import { getHeroes, getMaps, getGamemodes } from '../lib/overfast.js';
import { KLEUR, statusTekst } from '../lib/embed.js';
import { datumNL } from '../lib/format.js';

export const data = new SlashCommandBuilder()
  .setName('owstatus')
  .setDescription('Welke databronnen deze bot gebruikt en of ze werken');

export async function execute(interaction) {
  const embed = new EmbedBuilder().setColor(KLEUR).setTitle('Databronnen van deze bot');

  // 1. Seizoensdataset (Overwatch Wiki)
  try {
    const info = await datasetInfo();
    const { huidig, inVenster } = await huidigSeizoen();
    const status = huidig ? seizoenStatus(huidig) : null;
    embed.addFields({
      name: 'Seizoenen en events - Overwatch Wiki (community)',
      value: [
        `Arc: ${info.arc} - ${info.aantalSeizoenen} seizoenen - gesynct ${info.generatedAt.slice(0, 10)}`,
        `Huidig: ${huidig ? `${huidig.title} (${statusTekst(status)})` : 'niet bepaald'}`,
        status && !status.eindExact
          ? `Einddatum in de bron is alleen een maand (${datumNL(huidig.end)} is dus uiterlijk, niet exact)`
          : null,
        inVenster ? null : 'LET OP: de dataset dekt de huidige datum niet - draai `npm run sync`',
        'Er is geen officiele Blizzard-API voor seizoenen of events; deze data komt van de wiki.',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  } catch (err) {
    embed.addFields({ name: 'Seizoenen en events - Overwatch Wiki (community)', value: `FOUT: ${err.message}` });
  }

  // 2. OverFast API
  try {
    const [heroes, maps, gamemodes] = await Promise.all([getHeroes(), getMaps(), getGamemodes()]);
    embed.addFields({
      name: 'Heroes, maps, spelers - OverFast API',
      value: [
        `Online: ${heroes.length} heroes, ${maps.length} maps, ${gamemodes.length} gamemodes`,
        'Levert GEEN seizoenen, events of countdowns - alleen hero/map/spelerdata.',
        'Publieke limiet: 30 requests/seconde; deze bot cachet in geheugen.',
      ].join('\n'),
    });
  } catch (err) {
    embed.addFields({ name: 'Heroes, maps, spelers - OverFast API', value: `NIET BEREIKBAAR: ${err.message}` });
  }

  embed.setFooter({ text: 'Seizoensdata is community-data; controleer data voor je er iets belangrijks op baseert.' });
  return interaction.editReply({ embeds: [embed] });
}

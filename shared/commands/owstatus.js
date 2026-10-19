import { datasetInfo } from '../lib/store.js';
import { huidigSeizoen, seizoenStatus } from '../lib/season.js';
import { getHeroes, getMaps, getGamemodes } from '../lib/overfast.js';
import { KLEUR, statusTekst } from '../lib/embed.js';
import { datumNL, kort, vandaagISO } from '../lib/format.js';

export const definition = {
  name: 'owstatus',
  description: 'Welke databronnen deze bot gebruikt en of ze werken',
};

export async function run({ nu = new Date() } = {}) {
  const fields = [];

  // 1. Seizoensdataset (Overwatch Wiki / KV / bestand)
  try {
    const info = await datasetInfo();
    const { huidig, inVenster } = await huidigSeizoen(nu);
    const status = huidig ? seizoenStatus(huidig, nu) : null;
    fields.push({
      name: 'Seizoenen en events - Overwatch Wiki (community)',
      value: kort(
        [
          `Arc: ${info.arc} - ${info.aantalSeizoenen} seizoenen - gesynct ${String(info.generatedAt).slice(0, 10)}`,
          `Huidig: ${huidig ? `${huidig.title} (${statusTekst(status)})` : 'niet bepaald'}`,
          status && !status.eindExact
            ? `Einddatum in de bron is alleen een maand (${datumNL(huidig.end)} is dus uiterlijk, niet exact)`
            : null,
          inVenster ? null : `LET OP: de dataset dekt ${vandaagISO(nu)} niet - sync opnieuw`,
          'Er is geen officiele Blizzard-API voor seizoenen of events; deze data komt van de wiki.',
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    });
  } catch (err) {
    fields.push({ name: 'Seizoenen en events - Overwatch Wiki (community)', value: `FOUT: ${err.message}` });
  }

  // 2. OverFast API
  try {
    const [heroes, maps, gamemodes] = await Promise.all([getHeroes(), getMaps(), getGamemodes()]);
    fields.push({
      name: 'Heroes, maps, spelers - OverFast API',
      value: [
        `Online: ${heroes.length} heroes, ${maps.length} maps, ${gamemodes.length} gamemodes`,
        'Levert GEEN seizoenen, events of countdowns - alleen hero/map/spelerdata.',
        'Publieke limiet: 30 requests/seconde.',
      ].join('\n'),
    });
  } catch (err) {
    fields.push({ name: 'Heroes, maps, spelers - OverFast API', value: `NIET BEREIKBAAR: ${err.message}` });
  }

  return {
    embeds: [
      {
        color: KLEUR,
        title: 'Databronnen van deze bot',
        fields,
        footer: { text: 'Seizoensdata is community-data; controleer data voor je er iets belangrijks op baseert.' },
      },
    ],
  };
}

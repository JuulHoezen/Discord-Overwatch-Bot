/**
 * Commands als platte Discord-JSON plus een `run()` die platte payloads
 * teruggeeft. Zo werkt dezelfde code in de Gateway-bot, in de Cloudflare
 * Worker en in de rooktest — zonder discord.js.
 *
 * Optietypes (Discord API): 3 = STRING, 4 = INTEGER, 5 = BOOLEAN.
 */

import { huidigSeizoen, seizoenOpNummer } from '../lib/season.js';
import { seizoenEmbed, bronVoet, startLabel } from '../lib/embed.js';
import { vandaagISO } from '../lib/format.js';

export const definition = {
  name: 'season',
  description: 'Overwatch-seizoen: looptijd, countdown tot het einde en inhoud',
  options: [
    {
      type: 4,
      name: 'nummer',
      description: 'Seizoensnummer binnen de huidige arc (1 = het eerste seizoen van die arc)',
      min_value: 1,
      max_value: 30,
    },
  ],
};

export async function run({ opties = {}, nu = new Date() } = {}) {
  const nummer = opties.nummer ?? null;
  const { huidig, volgende, inVenster, data } = await huidigSeizoen(nu);
  const seizoen = nummer ? await seizoenOpNummer(nummer) : huidig;

  if (!seizoen) {
    return {
      content:
        `Geen seizoen gevonden voor nummer ${nummer ?? '(huidig)'}. ` +
        `De dataset bevat seizoen 1 t/m ${data.seasons.length} van de arc "${data.arc.name}".`,
    };
  }

  const embed = seizoenEmbed(seizoen, { nu, bron: bronVoet(data), totaal: data.seasons.length });

  const opmerkingen = [];
  if (!inVenster) {
    opmerkingen.push(
      `Let op: de dataset is gesynct op ${data.generated_at.slice(0, 10)} en heeft geen venster dat ${vandaagISO(nu)} dekt.`,
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

  return { content: opmerkingen.join('\n') || undefined, embeds: [embed] };
}

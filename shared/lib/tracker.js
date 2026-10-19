/**
 * Het countdown-bericht. Eén plek, zodat de Gateway-bot en de Worker exact
 * hetzelfde bericht plaatsen en herkennen (via TRACKER_MARKER in de footer).
 */

import { huidigSeizoen } from './season.js';
import { seizoenEmbed, bronVoet, TRACKER_MARKER } from './embed.js';

export async function trackerEmbed({ nu = new Date() } = {}) {
  const { huidig, data } = await huidigSeizoen(nu);
  if (!huidig) throw new Error('Geen huidig seizoen in de dataset; sync opnieuw');
  const embed = seizoenEmbed(huidig, { nu, bron: bronVoet(data), totaal: data.seasons.length });
  embed.footer = { text: `${embed.footer?.text ?? ''} | ${TRACKER_MARKER}` };
  return embed;
}

export { TRACKER_MARKER };

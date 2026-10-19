/** Embed-opbouw voor seizoenen, events en bronvermelding. */

import { EmbedBuilder } from 'discord.js';
import { seizoenStatus, venster } from './season.js';
import { datumNL, maandNL, voortgangsbalk } from './format.js';

export const KLEUR = 0xf99e1a; // Overwatch-oranje
export const TRACKER_MARKER = 'OW-SEASON-TRACKER';

/** Einddatum zoals de bron die geeft; zonder dag zeggen we dat er expliciet bij. */
export function eindLabel(seizoen) {
  if (!seizoen?.end) return 'onbekend';
  return seizoen.end_precision === 'month'
    ? `${maandNL(seizoen.end)} (exacte dag nog niet aangekondigd)`
    : datumNL(seizoen.end);
}

export function startLabel(seizoen) {
  if (!seizoen?.start) return 'onbekend';
  return (seizoen.start_precision ?? 'day') === 'month' ? maandNL(seizoen.start) : datumNL(seizoen.start);
}

function regel(items, leeg = 'niets vermeld') {
  if (!items?.length) return leeg;
  return items.map((i) => (typeof i === 'string' ? i : i.naam)).join(', ');
}

export function statusTekst(status) {
  if (status.dagenTotStart > 0) return `begint over ${status.dagenTotStart} dag(en)`;
  if (status.dagenTotEind < 0) return 'afgelopen';
  return `nog ${status.dagenTotEind} dag(en) - ${voortgangsbalk(status.voortgang)} ${Math.round(status.voortgang * 100)}%`;
}

export function eventsTekst(events) {
  return events
    .map((e) => {
      if (e.start && e.end) return `${e.naam} (${datumNL(e.start)} t/m ${datumNL(e.end)})`;
      if (e.start) return `${e.naam} (${maandNL(e.start)})`;
      return `${e.naam} (datum niet in de bron vermeld)`;
    })
    .join('\n');
}

/** Bron + sync-datum; het is community-data, geen Blizzard-API. */
export function bronVoet(data, { extra = null } = {}) {
  const syncDatum = data?.generated_at ? new Date(data.generated_at).toISOString().slice(0, 10) : 'onbekend';
  const delen = [`Bron: Overwatch Wiki (community), gesynct ${syncDatum}`];
  if (extra) delen.push(extra);
  return delen.join(' - ');
}

/** Compacte embed voor één seizoen, met countdown. */
export function seizoenEmbed(seizoen, { nu = new Date(), bron = null, totaal = null } = {}) {
  const status = seizoenStatus(seizoen, nu);
  const embed = new EmbedBuilder()
    .setColor(KLEUR)
    .setTitle(seizoen.title)
    .addFields(
      { name: 'Loopt van', value: startLabel(seizoen), inline: true },
      { name: status.eindExact ? 'Loopt tot' : 'Loopt tot (uiterlijk)', value: eindLabel(seizoen), inline: true },
      { name: 'Status', value: statusTekst(status), inline: true },
    );

  if (seizoen.theme) embed.addFields({ name: 'Verhaallijn', value: seizoen.theme });
  if (seizoen.heroes?.length) embed.addFields({ name: 'Nieuwe hero(s)', value: regel(seizoen.heroes) });
  if (seizoen.maps?.length) embed.addFields({ name: 'Nieuwe map(s)', value: regel(seizoen.maps) });
  if (seizoen.map_reworks?.length) embed.addFields({ name: 'Map-herwerkingen', value: regel(seizoen.map_reworks) });
  if (seizoen.hero_reworks?.length) embed.addFields({ name: 'Hero-herwerkingen', value: regel(seizoen.hero_reworks) });
  if (seizoen.events?.length) embed.addFields({ name: 'Events', value: eventsTekst(seizoen.events) });
  if (seizoen.collaborations?.length) embed.addFields({ name: 'Samenwerkingen', value: regel(seizoen.collaborations) });

  const voet = [totaal ? `Seizoen ${seizoen.index} van ${totaal} in deze arc` : `Seizoen ${seizoen.index}`];
  if (bron) voet.push(bron);
  embed.setFooter({ text: voet.join(' - ') });
  return embed;
}

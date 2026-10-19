/** Opmaak-hulpjes: datums in het Nederlands, voortgangsbalken, duur. */

const MAANDEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

/** '2026-10-06' -> '6 oktober 2026'. Werkt op UTC-delen om tijdzone-drift te voorkome n. */
export function datumNL(iso) {
  if (!iso) return 'onbekend';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MAANDEN[m - 1]} ${y}`;
}

/** '2026-12' -> 'december 2026' (voor datums zonder dag). */
export function maandNL(iso) {
  if (!iso) return 'onbekend';
  const [y, m] = iso.split('-').map(Number);
  return `${MAANDEN[m - 1]} ${y}`;
}

/** Aantal hele dagen tussen twee datums (UTC-datumdelen, dus geen zomertijdgedoe). */
export function dagenTussen(van, tot) {
  const a = Date.UTC(van.getUTCFullYear(), van.getUTCMonth(), van.getUTCDate());
  const b = Date.UTC(tot.getUTCFullYear(), tot.getUTCMonth(), tot.getUTCDate());
  return Math.round((b - a) / 86400000);
}

/** Voortgangsbalk, bv. '████░░░░░░' */
export function voortgangsbalk(ratio, lengte = 10) {
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const vol = Math.round(r * lengte);
  return '█'.repeat(vol) + '░'.repeat(lengte - vol);
}

/** Milliseconden -> leesbare duur in het Nederlands. */
export function duurNL(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 minuten';
  const min = Math.floor(ms / 60000);
  const dagen = Math.floor(min / 1440);
  const uren = Math.floor((min % 1440) / 60);
  const minuten = min % 60;
  const delen = [];
  if (dagen) delen.push(`${dagen} dag${dagen === 1 ? '' : 'en'}`);
  if (uren) delen.push(`${uren} uur`);
  if (!dagen && minuten) delen.push(`${minuten} minuten`);
  return delen.join(' ') || '0 minuten';
}

/** Discord-relatieve tijd, bv. <t:1234567890:R> */
export function relatieveTijd(date) {
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}

/** Discord-relatieve tijd met volledige datum, bv. <t:...:f> */
export function volledigeTijd(date) {
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:f>`;
}

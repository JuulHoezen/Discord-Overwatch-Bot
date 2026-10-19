/**
 * Seizoenslogica: welk seizoen loopt nu, hoelang nog, hoe ver zijn we.
 *
 * Belangrijk: de Overwatch Wiki geeft niet altijd een exacte einddatum.
 * Seizoen 5 van de arc "Reign of Talon" staat er bijvoorbeeld als
 * "6 October 2026 - December 2026". In dat geval rekenen we met de laatste
 * dag van die maand en zeggen we dat er expliciet bij ("uiterlijk").
 */

import { laadDataset } from './store.js';
import { dagenTussen } from './format.js';

/** 'YYYY-MM-DD' of 'YYYY-MM' -> Date (UTC, middernacht). */
export function naarDatum(iso, { eindeVanMaand = false } = {}) {
  if (!iso) return null;
  const delen = iso.split('-').map(Number);
  const [j, m, d] = [delen[0], delen[1], delen[2] ?? 1];
  if (delen.length === 2 && eindeVanMaand) {
    return new Date(Date.UTC(j, m, 0)); // dag 0 van de volgende maand = laatste dag van deze maand
  }
  return new Date(Date.UTC(j, m - 1, d));
}

/** Seizoensvenster met effectieve datums en of de einddatum exact is. */
export function venster(seizoen) {
  const start = naarDatum(seizoen.start);
  const eindExact = (seizoen.end_precision ?? 'day') === 'day';
  const eind = naarDatum(seizoen.end, { eindeVanMaand: !eindExact });
  return { start, eind, eindExact };
}

export async function laadSeizoenen() {
  const data = await laadDataset();
  return data;
}

/** Het seizoen dat op `nu` loopt, plus het volgende seizoen. */
export async function huidigSeizoen(nu = new Date()) {
  const data = await laadDataset();
  const seizoenen = [...data.seasons].sort((a, b) => a.index - b.index);
  let huidig = null;
  let volgende = null;

  for (const s of seizoenen) {
    const { start, eind } = venster(s);
    if (start && eind && nu >= start && nu <= eind) {
      huidig = s;
      break;
    }
    if (start && start > nu && !volgende) volgende = s;
  }

  if (huidig) {
    // Volgende seizoen hoort bij de positie in de lijst, niet bij het venster.
    volgende = seizoenen[seizoenen.indexOf(huidig) + 1] ?? null;
    return { huidig, volgende, inVenster: true, data };
  }
  // Buiten de bekende vensters (bv. dataset is verouderd): pak het laatste
  // seizoen dat begonnen is, of het eerstvolgende.
  const gestart = seizoenen.filter((s) => naarDatum(s.start) <= nu);
  huidig = gestart.at(-1) ?? null;
  if (huidig && !volgende) volgende = seizoenen[seizoenen.indexOf(huidig) + 1] ?? null;
  return { huidig, volgende, inVenster: false, data };
}

/** Countdown-info voor één seizoen. */
export function seizoenStatus(seizoen, nu = new Date()) {
  const { start, eind, eindExact } = venster(seizoen);
  const dagenTotEind = dagenTussen(nu, eind);
  const dagenTotStart = dagenTussen(nu, start);
  const totaleDagen = dagenTussen(start, eind);
  const verstreken = Math.max(0, Math.min(totaleDagen, dagenTussen(start, nu)));
  return {
    start,
    eind,
    eindExact,
    dagenTotEind,
    dagenTotStart,
    totaleDagen,
    verstreken,
    voortgang: totaleDagen > 0 ? verstreken / totaleDagen : 0,
  };
}

/**
 * Het seizoensnummer zoals Blizzard het in het spelersprofiel noemt.
 * Overwatch 2 had 20 seizoenen (okt 2022 - feb 2026); de 2026-arc begint bij 21.
 * Dit is een AFGELEIDE, geen rechtstreeks veld uit de bron: bij twijfel
 * het nummer uit het profiel zelf tonen.
 */
export function gameSeizoensnummer(arcSeizoenIndex, offset = 20) {
  return Number.isFinite(arcSeizoenIndex) ? offset + arcSeizoenIndex : null;
}

/** Seizoen op basis van een opgegeven nummer (arc-nummer). */
export async function seizoenOpNummer(nummer) {
  const data = await laadDataset();
  return data.seasons.find((s) => s.index === Number(nummer)) ?? null;
}

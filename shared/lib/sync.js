/**
 * Haalt de Overwatch Wiki (Fandom, community) op en zet de seizoenen van de
 * huidige story arc in een dataset-object.
 *
 * Levert alleen data; de aanroeper bepaalt waar die blijft:
 *   - Node: bot/sync.js schrijft bot/data/seasons.json
 *   - Worker: de wekelijkse cron zet hem in KV
 *
 * Waarom via de wiki? Blizzard publiceert geen API voor Overwatch-seizoenen en
 * -events. De wiki is de enige bron die dit bijhoudt; de output is dus
 * community-data en de bron staat in de dataset.
 *
 * De Fandom MediaWiki API vraagt een User-Agent en houdt van rustig aan doen:
 * 1 seconde tussen requests.
 */

const API = 'https://overwatch.fandom.com/api.php';
const UA = '1KEY-OverwatchBot/1.0 (intern gebruik; contact: beheerder 1KEY)';
const WACHT_MS = 1000;

const MAANDEN = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

async function wiki(actie, params = {}) {
  const url = new URL(API);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('action', actie);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wiki gaf HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Wiki-fout: ${json.error.info} (${json.error.code})`);
  return json;
}

async function wikitext(pagina) {
  const json = await wiki('parse', { page: pagina, prop: 'wikitext' });
  return json.parse.wikitext ?? '';
}

// ---------------------------------------------------------------- opschonen

export function schoon(tekst) {
  return String(tekst ?? '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<span[^>]*><\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{rl\|[^|]*\|([^}|]+)\}\}/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/''/g, '')
    .replace(/^\*+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --------------------------------------------------------------- datums

/** '10 February 2026' of 'December 2026' -> { iso, precisie } */
export function datumUitTekst(tekst) {
  const t = schoon(tekst).replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const maand = MAANDEN[m[2].toLowerCase()];
    if (maand) {
      return { iso: `${m[3]}-${String(maand).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`, precisie: 'day' };
    }
  }
  m = t.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const maand = MAANDEN[m[1].toLowerCase()];
    if (maand) return { iso: `${m[2]}-${String(maand).padStart(2, '0')}`, precisie: 'month' };
  }
  return null;
}

/** Seizoensvenster '(10 February 2026 - 14 April 2026)' */
export function vensterUitBlok(blok) {
  const m = blok.match(/\(([^()]*?\d{4}[^()]*?)\)/);
  if (!m) return null;
  const delen = m[1].split(/\s+(?:-|–|—|to)\s+/);
  if (delen.length < 2) return null;
  const start = datumUitTekst(delen[0]);
  const eind = datumUitTekst(delen.slice(1).join(' to '));
  if (!start || !eind) return null;
  return { start: start.iso, end: eind.iso, start_precision: start.precisie, end_precision: eind.precisie };
}

/** Regels onder een vetgedrukte kop binnen een seizoensblok, bv. 'New Hero:'. */
export function blokVan(blok, kopRegex) {
  const regels = blok.split('\n');
  const start = regels.findIndex((r) => kopRegex.test(r));
  if (start === -1) return [];
  const diepte = (regels[start].match(/^\*+/) ?? ['*'])[0].length;
  const uit = [];
  for (let i = start + 1; i < regels.length; i++) {
    const kaal = regels[i].trim();
    if (!kaal) break; // lege regel: einde van de lijst
    if (!/^\*/.test(kaal)) break; // geen bullet meer
    if (/^\*+\s*'''/.test(kaal)) break; // volgende vetgedrukte kop
    if (kaal.match(/^\*+/)[0].length <= diepte) break; // terug naar bovenliggend niveau
    uit.push(kaal);
  }
  return uit.map(schoon).filter(Boolean);
}

function namenUit(lijst) {
  return lijst
    .map((r) => r.replace(/^\(([^)]*)\)\s*/, '').trim())
    .map((r) => {
      const m = r.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      return m ? { naam: m[1], rol: m[2] } : { naam: r };
    })
    .filter((x) => x.naam && !/^TBA$/i.test(x.naam));
}

// -------------------------------------------------- seizoenen uit de wikitext

export function parseSeizoenen(tekst) {
  const sectie = (tekst.split(/==\s*List of Seasons\s*==/)[1] ?? tekst)
    // De koppen bevatten ankerlinks met een '=' in de attributen; die eerst weg.
    .replace(/<span[^>]*><\/span>/g, '');
  const kop = /===\s*Season\s+(\d+)\s*:\s*(.+?)===\s*$/gm;
  const koppen = [...sectie.matchAll(kop)];
  const seizoenen = [];

  koppen.forEach((m, i) => {
    const start = m.index + m[0].length;
    const eind = i + 1 < koppen.length ? koppen[i + 1].index : sectie.length;
    const blok = sectie.slice(start, eind);
    const naam = schoon(m[2]);
    const venster = vensterUitBlok(blok);

    const themaRegel = blok.split('\n').find((r) => /'''\s*Theme and [Ss]tory/i.test(r));
    const helden = namenUit(blokVan(blok, /'''\s*(?:\d+\s+)?New Hero(?:es)?:?\s*'''/i));
    const events = blokVan(blok, /'''\s*Events:?\s*'''/i).map((r) => ({
      // Meteen normaliseren: wiki-restjes als "Summer Games 2026" of "return"
      // horen niet in de naam, ook niet als we de eventpagina's niet ophalen.
      naam: normaliseerEventNaam(r),
      start: null,
      end: null,
      precisie: null,
    }));
    const collabs = blokVan(blok, /'''\s*(?:New |Returning )?Collaborations?:?\s*'''/i).map((r) => ({
      naam: normaliseerEventNaam(r),
    }));
    const maps = blokVan(blok, /'''\s*New Maps?:?\s*'''/i).map((naam) => ({ naam }));
    const mapReworks = blokVan(blok, /'''\s*Map Reworks?:?\s*'''/i).map((naam) => ({ naam }));
    const heroReworks = blokVan(blok, /'''\s*Hero Reworks?:?\s*'''/i).map((naam) => ({ naam }));

    seizoenen.push({
      index: Number(m[1]),
      name: naam,
      title: `Season ${m[1]}: ${naam}`,
      ...(venster ?? { start: null, end: null, start_precision: null, end_precision: null }),
      theme: themaRegel
        ? schoon(themaRegel).replace(/^Theme and [Ss]tory:?\s*/i, '').replace(/^(?:and|\+)\s+/i, '').trim() || null
        : null,
      heroes: helden,
      events,
      collaborations: collabs,
      maps,
      map_reworks: mapReworks,
      hero_reworks: heroReworks,
    });
  });

  return seizoenen;
}

// --------------------------------------------------------------- events

/** Zoekt in de wikitext van een eventpagina de datumregel van één jaar. */
export function parseEventDatums(tekst, jaar) {
  const sectie = tekst.split(/==\s*Dates\s*==/i)[1]?.split(/^==[^=]/m)[0] ?? '';
  const regel = sectie.split('\n').map(schoon).find((r) => new RegExp(`^${jaar}\\s*:`).test(r));
  if (!regel) return null;
  let rest = regel.replace(new RegExp(`^${jaar}\\s*:\\s*`), '').replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  rest = rest.replace(/\s+(?:to|until|till|through)\s+/i, ' | ').replace(/\s+[-–—]\s+/g, ' | ');
  const delen = rest.split('|').map((d) => d.trim()).filter(Boolean);
  if (delen.length < 2) return null;

  const leesDatum = (deel, terugvalMaand) => {
    let m = deel.match(/^(\d{1,2})\s+([A-Za-z]+)$/);
    if (m) return { dag: Number(m[1]), maand: MAANDEN[m[2].toLowerCase()] ?? terugvalMaand };
    m = deel.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    if (m) return { dag: Number(m[2]), maand: MAANDEN[m[1].toLowerCase()] ?? terugvalMaand };
    m = deel.match(/^([A-Za-z]+)$/);
    if (m && terugvalMaand) return { dag: null, maand: MAANDEN[m[1].toLowerCase()] ?? terugvalMaand };
    m = deel.match(/^(\d{1,2})$/);
    if (m && terugvalMaand) return { dag: Number(m[1]), maand: terugvalMaand };
    return null;
  };

  const a = leesDatum(delen[0], null);
  const b = leesDatum(delen[1], a?.maand ?? null);
  if (!a || !b || !a.maand || !b.maand) return null;

  const iso = (d, m, j) => `${j}-${String(m).padStart(2, '0')}-${d ? String(d).padStart(2, '0') : '01'}`;
  const eindJaar = b.maand < a.maand ? jaar + 1 : jaar;
  return { start: iso(a.dag, a.maand, jaar), end: iso(b.dag, b.maand, eindJaar), precisie: a.dag && b.dag ? 'day' : 'month' };
}

export const EVENT_ALIASES = new Map([
  ['Summer Games', 'Summer Games'],
  ['Anniversary', 'Anniversary'],
  ['Overwatch 10-Year Anniversary', 'Anniversary'],
]);

/** Haalt wiki-restjes zoals 'return' of '(Midseason)' van een eventnaam af. */
export function normaliseerEventNaam(naam) {
  return schoon(naam)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s*\b(return|returns|20\d\d)\b\s*$/i, '')
    .trim();
}

async function verrijkEvents(seizoenen, jaar, { maxPagina = 12, log = () => {} } = {}) {
  let aanvragen = 0;
  let gelukt = 0;
  const mislukt = [];
  // Nieuwste seizoenen eerst: die zijn het interessantst als we het budget raken.
  for (const seizoen of [...seizoenen].sort((a, b) => b.index - a.index)) {
    for (const event of seizoen.events) {
      const origineel = normaliseerEventNaam(event.naam);
      event.naam = origineel;
      if (aanvragen >= maxPagina) continue;
      const pagina = EVENT_ALIASES.get(origineel) ?? origineel;
      aanvragen++;
      try {
        await slaap(WACHT_MS);
        const datums = parseEventDatums(await wikitext(pagina), jaar);
        if (datums) {
          Object.assign(event, { start: datums.start, end: datums.end, precisie: datums.precisie });
          gelukt++;
        } else {
          mislukt.push(`${origineel} (geen datumregel)`);
        }
      } catch {
        mislukt.push(`${origineel} (geen wikipagina)`);
      }
    }
  }
  log(`  ${aanvragen} eventpagina's geprobeerd, ${gelukt} met datum`);
  if (mislukt.length) log(`  zonder datum: ${mislukt.join(', ')}`);
}

// ----------------------------------------------------------------- hoofd

/**
 * Leest de wiki en geeft de dataset terug (schrijft niets weg).
 *
 * letOp: de Worker-cron gebruikt metEvents: false, want het gratis CPU-budget
 * (10 ms) is te krap voor tientallen extra requests.
 */
export async function sync({ jaar = null, metEvents = true, maxEventPagina = 12, log = () => {} } = {}) {
  log('Overwatch Wiki uitlezen...');

  const hoofdTekst = await wikitext('Season');
  const jaren = [...hoofdTekst.matchAll(/Season\/(\d{4})/g)].map((m) => Number(m[1]));
  const kandidaten = jaren.filter((j) => j <= new Date().getUTCFullYear());
  const doelJaar = jaar ?? (kandidaten.length ? Math.max(...kandidaten) : new Date().getUTCFullYear());
  log(`  arc-pagina: Season/${doelJaar}`);

  await slaap(WACHT_MS);
  const arcTekst = await wikitext(`Season/${doelJaar}`);
  const seizoenen = parseSeizoenen(arcTekst);
  if (!seizoenen.length) throw new Error('Geen seizoenen gevonden in de wikitext; parser moet worden bijgewerkt');
  log(`  ${seizoenen.length} seizoenen gevonden`);

  if (metEvents) await verrijkEvents(seizoenen, doelJaar, { maxPagina: maxEventPagina, log });

  const arcNaam = schoon(arcTekst.match(/'''''([^']+)'''''/)?.[1] ?? `Arc ${doelJaar}`);

  return {
    generated_at: new Date().toISOString(),
    source: `https://overwatch.fandom.com/wiki/Season/${doelJaar} (Overwatch Wiki, community-data - geen officiele Blizzard-bron)`,
    source_page: `Season/${doelJaar}`,
    arc: {
      name: arcNaam,
      page: `Season/${doelJaar}`,
      year: doelJaar,
      season_count: seizoenen.length,
      // Overwatch 2 kende 20 seizoenen (okt 2022 - feb 2026) voor deze arc begon.
      game_season_offset: 20,
    },
    seasons: seizoenen,
  };
}

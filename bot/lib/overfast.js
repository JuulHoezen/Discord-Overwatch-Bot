/**
 * Client voor de OverFast API (https://overfast-api.tekrop.fr).
 *
 * Wat deze API WEL levert: heroes, maps, gamemodes, rollen, perks en
 * spelerstatistieken (gescrapet van Blizzard).
 * Wat deze API NIET levert: seizoenen, seizoensdata, events, countdowns.
 * Daarvoor gebruikt de bot de Overwatch Wiki (zie bot/lib/sync.js).
 *
 * Limieten van de publieke instantie: 30 requests/seconde, max 10
 * gelijktijdige requests. Daarom cachen we alles in geheugen.
 */

const BASE_URL = () => process.env.OVERFAST_BASE_URL || 'https://overfast-api.tekrop.fr';
const USER_AGENT = '1KEY-OverwatchBot/1.0 (+intern gebruik)';

export class OverfastError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'OverfastError';
    this.status = status;
  }
}

const cache = new Map(); // url -> { at, ttl, data }

export async function owFetch(path, { ttl = 6 * 60 * 60 * 1000, timeout = 15000 } = {}) {
  const url = path.startsWith('http') ? path : BASE_URL() + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
  } catch (err) {
    throw new OverfastError(
      err.name === 'AbortError' ? 'OverFast API reageerde niet binnen 15 seconden' : `Netwerkfout naar OverFast API: ${err.message}`,
      null,
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new OverfastError('OverFast API rate limit bereikt, probeer het zo opnieuw', 429);
  if (res.status === 404) throw new OverfastError('Niet gevonden in de OverFast API', 404);
  if (!res.ok) throw new OverfastError(`OverFast API gaf HTTP ${res.status}`, res.status);

  const data = await res.json();
  cache.set(url, { at: Date.now(), ttl, data });
  return data;
}

/** Lijst van alle heroes (54 stuks, key/name/role/subrole/gamemodes). */
export const getHeroes = () => owFetch('/heroes', { ttl: 24 * 60 * 60 * 1000 });

/** Detail van één hero: abilities, perks, hitpoints, story. */
export const getHero = (key) => owFetch(`/heroes/${encodeURIComponent(key)}`, { ttl: 24 * 60 * 60 * 1000 });

/** Alle maps met gamemode(s), locatie en landcode. */
export const getMaps = () => owFetch('/maps', { ttl: 24 * 60 * 60 * 1000 });

/** Alle gamemodes met beschrijving. */
export const getGamemodes = () => owFetch('/gamemodes', { ttl: 24 * 60 * 60 * 1000 });

/** Zoek een speler op naam; geeft { total, results: [...] } terug. */
export const searchPlayer = (name) =>
  owFetch(`/players?name=${encodeURIComponent(name)}`, { ttl: 10 * 60 * 1000 });

/**
 * Volledige spelerdata. De summary-endpoint verwacht de player_id zoals de
 * zoekopdracht die teruggeeft; een BattleTag werkt alleen als die al bekend is.
 * Let op: /players/{id} geeft { summary, stats }, /players/{id}/summary geeft
 * het summary-object zelf.
 */
export const getPlayer = (playerId) =>
  owFetch(`/players/${encodeURIComponent(playerId)}/summary`, { ttl: 30 * 60 * 1000 });

/** Volledige carrière (summary + stats); zwaarder, dus alleen als je stats nodig hebt. */
export const getPlayerCareer = (playerId) =>
  owFetch(`/players/${encodeURIComponent(playerId)}`, { ttl: 30 * 60 * 1000 });

/** Statuspagina van de publieke instantie (uptime/versie). */
export const getStatus = () => owFetch('/heroes/stats', { ttl: 5 * 60 * 1000 });

/** Zoekt een hero op (key of naam, hoofdletterongevoelig, ook deels). */
export async function resolveHero(query) {
  const heroes = await getHeroes();
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  return (
    heroes.find((h) => h.key === q) ||
    heroes.find((h) => h.name.toLowerCase() === q) ||
    heroes.find((h) => h.name.toLowerCase().startsWith(q)) ||
    heroes.find((h) => h.name.toLowerCase().includes(q)) ||
    null
  );
}

/** Zoekt een map op (key of naam, hoofdletterongevoelig, ook deels). */
export async function resolveMap(query) {
  const maps = await getMaps();
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  return (
    maps.find((m) => m.key === q) ||
    maps.find((m) => m.name.toLowerCase() === q) ||
    maps.find((m) => m.name.toLowerCase().startsWith(q)) ||
    maps.find((m) => m.name.toLowerCase().includes(q)) ||
    null
  );
}

export function clearCache() {
  cache.clear();
}

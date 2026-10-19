/**
 * Client voor de OverFast API (https://overfast-api.tekrop.fr).
 *
 * Levert heroes, maps, gamemodes en spelersprofielen. GEEN seizoenen of events;
 * die komen uit de Overwatch Wiki (zie shared/lib/sync.js).
 *
 * Werkt in Node en in Cloudflare Workers. In Workers laat de `cf`-optie
 * Cloudflare zelf cachen (cacheEverything), in Node wordt die optie genegeerd.
 * Publieke limiet: 30 requests/seconde.
 */

const USER_AGENT = '1KEY-OverwatchBot/1.0 (intern gebruik)';

export class OverfastError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'OverfastError';
    this.status = status;
  }
}

const cache = new Map(); // url -> { at, ttl, data }

function basisUrl() {
  return (typeof process !== 'undefined' && process.env?.OVERFAST_BASE_URL) || 'https://overfast-api.tekrop.fr';
}

export async function owFetch(path, { ttl = 6 * 60 * 60 * 1000, timeout = 15000 } = {}) {
  const url = path.startsWith('http') ? path : basisUrl() + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      // Alleen zinvol in Workers; Node negeert onbekende opties.
      cf: { cacheEverything: true, cacheTtl: Math.floor(ttl / 1000) },
    });
  } catch (err) {
    throw new OverfastError(
      err.name === 'AbortError'
        ? 'OverFast API reageerde niet binnen 15 seconden'
        : `Netwerkfout naar OverFast API: ${err.message}`,
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
  if (cache.size > 500) cache.clear();
  return data;
}

/** Lijst van alle heroes (key/name/role/subrole/gamemodes). */
export const getHeroes = () => owFetch('/heroes', { ttl: 24 * 60 * 60 * 1000 });

/** Detail van één hero: abilities, perks, hitpoints. */
export const getHero = (key) => owFetch(`/heroes/${encodeURIComponent(key)}`, { ttl: 24 * 60 * 60 * 1000 });

/** Alle maps met gamemode(s), locatie en landcode. */
export const getMaps = () => owFetch('/maps', { ttl: 24 * 60 * 60 * 1000 });

/** Alle gamemodes met beschrijving. */
export const getGamemodes = () => owFetch('/gamemodes', { ttl: 24 * 60 * 60 * 1000 });

/** Zoek een speler op naam of BattleTag; geeft { total, results: [...] }. */
export const searchPlayer = (naam) => owFetch(`/players?name=${encodeURIComponent(naam)}`, { ttl: 10 * 60 * 1000 });

/**
 * Spelersprofiel. Let op: /players/{id} geeft { summary, stats },
 * /players/{id}/summary geeft het summary-object zelf.
 */
export const getPlayer = (playerId) => owFetch(`/players/${encodeURIComponent(playerId)}/summary`, { ttl: 30 * 60 * 1000 });

/** Zoekt een hero op key of (deel van de) naam. */
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

/** Zoekt een map op key of (deel van de) naam. */
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

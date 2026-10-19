/**
 * Toegang tot de seizoensdataset, met een instelbare bron.
 *
 * De dataset (bot/data/seasons.json) is community-data uit de Overwatch Wiki;
 * er is geen officiële Blizzard-API voor seizoenen en events.
 *
 * - Node (Gateway-bot, sync, rooktest): leest het bestand, cachet op mtime.
 * - Cloudflare Worker: leest de KV-store, met de meegebouwde JSON als terugval.
 *
 * De loader bepaalt de bron; `sleutel === null` betekent "niet cachen".
 */

let loader = null;
let cache = { sleutel: null, data: null };

/** Stelt de bron in. Geef een functie die { sleutel, data } teruggeeft. */
export function setDatasetLoader(fn) {
  loader = fn;
  cache = { sleutel: null, data: null };
}

export async function laadDataset() {
  if (!loader) throw new Error('Geen dataset-loader ingesteld; roep setDatasetLoader() eerst aan');
  const { sleutel, data } = await loader();
  if (sleutel !== null && cache.data && cache.sleutel === sleutel) return cache.data;
  if (sleutel !== null) cache = { sleutel, data };
  return data;
}

/** Kerngegevens over de dataset, voor /owstatus. */
export async function datasetInfo() {
  const data = await laadDataset();
  return {
    generatedAt: data.generated_at,
    bron: data.source,
    arc: data.arc?.name ?? 'onbekend',
    aantalSeizoenen: data.seasons?.length ?? 0,
  };
}

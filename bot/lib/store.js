/**
 * Leest de seizoensdataset (bot/data/seasons.json) die door bot/lib/sync.js
 * vanaf de Overwatch Wiki wordt gegenereerd.
 *
 * Er is geen officiële Blizzard-API voor Overwatch-seizoenen of -events.
 * De dataset is dus community-data: altijd met bron en sync-datum tonen.
 */

import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HIER = path.dirname(fileURLToPath(import.meta.url));
export const DATA_PAD = path.join(HIER, '..', 'data', 'seasons.json');

let cache = { mtimeMs: 0, data: null };

export async function laadDataset() {
  const info = await stat(DATA_PAD);
  if (cache.data && cache.mtimeMs === info.mtimeMs) return cache.data;
  const data = JSON.parse(await readFile(DATA_PAD, 'utf8'));
  cache = { mtimeMs: info.mtimeMs, data };
  return data;
}

export async function datasetInfo() {
  const data = await laadDataset();
  return {
    generatedAt: data.generated_at,
    bron: data.source,
    arc: data.arc?.name ?? 'onbekend',
    aantalSeizoenen: data.seasons?.length ?? 0,
    bestandGewijzigd: new Date(cache.mtimeMs).toISOString(),
  };
}

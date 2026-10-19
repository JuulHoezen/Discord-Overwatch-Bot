/**
 * Node-variant van de dataset-bron: leest bot/data/seasons.json.
 * De Worker gebruikt dezelfde store-module maar dan met KV als bron.
 */

import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setDatasetLoader } from '../shared/lib/store.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));

/** Pad naar de gegenereerde dataset (bot/sync.js schrijft hier). */
export const DATA_PAD = path.join(HIER, 'data', 'seasons.json');

/** Zet de bestandsdataset als bron. Cachet op bestands-mtime. */
export function gebruikBestandsdataset() {
  setDatasetLoader(async () => {
    const info = await stat(DATA_PAD);
    return { sleutel: info.mtimeMs, data: JSON.parse(await readFile(DATA_PAD, 'utf8')) };
  });
}

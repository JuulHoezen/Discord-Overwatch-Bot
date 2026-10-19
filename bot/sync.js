#!/usr/bin/env node
/**
 * Ververs de seizoensdataset vanaf de Overwatch Wiki.
 *
 * Draaien: npm run sync                  (huidige arc, inclusief eventdatums)
 *          node bot/sync.js 2026 --geen-events
 *
 * Schrijft bot/data/seasons.json. De Cloudflare-versie doet hetzelfde, maar
 * zet het resultaat in KV (zie worker/index.js, cron 'sync').
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sync } from '../shared/lib/sync.js';
import { DATA_PAD } from './node-store.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const jaar = args.find((a) => /^\d{4}$/.test(a));
const metEvents = !args.includes('--geen-events');

try {
  const dataset = await sync({
    jaar: jaar ? Number(jaar) : null,
    metEvents,
    log: (regel) => console.log(regel),
  });
  await mkdir(path.dirname(DATA_PAD), { recursive: true });
  await writeFile(DATA_PAD, JSON.stringify(dataset, null, 2) + '\n', 'utf8');

  // De Worker bouwt dezelfde data mee als terugval wanneer KV nog leeg is.
  // Bewust een .js-module: JSON-imports met import-attributen werken niet
  // overal even soepel.
  const seedPad = path.join(HIER, '..', 'worker', 'seed.js');
  await writeFile(
    seedPad,
    `// Gegenereerd door bot/sync.js - niet handmatig aanpassen.\nexport default ${JSON.stringify(dataset, null, 2)};\n`,
    'utf8',
  );

  console.log(`Weggeschreven: ${DATA_PAD} (${dataset.seasons.length} seizoenen, arc "${dataset.arc.name}")`);
  console.log(`Weggeschreven: ${seedPad}`);
} catch (err) {
  console.error('Sync mislukt:', err.message);
  process.exit(1);
}

/**
 * Command-register: de enige plek waar staat welke commands bestaan.
 * Wordt gebruikt door de Gateway-bot, de Cloudflare Worker en de rooktest.
 */

import * as season from './season.js';
import * as seasons from './seasons.js';
import * as event from './event.js';
import * as hero from './hero.js';
import * as map from './map.js';
import * as player from './player.js';
import * as owstatus from './owstatus.js';

export const COMMANDS = [season, seasons, event, hero, map, player, owstatus];

/** Command-definities zoals Discord ze verwacht (platte JSON). */
export function commandDefinities() {
  return COMMANDS.map((c) => c.definition);
}

export function vindCommand(naam) {
  return COMMANDS.find((c) => c.definition.name === naam) ?? null;
}

/** Zet interaction.options om naar een simpel { naam: waarde }-object. */
export function optiesVan(interaction) {
  const uit = {};
  for (const optie of interaction.data?.options ?? []) uit[optie.name] = optie.value;
  return uit;
}

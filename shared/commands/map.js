import { getGamemodes, getMaps, resolveMap } from '../lib/overfast.js';
import { KLEUR } from '../lib/embed.js';

export const definition = {
  name: 'map',
  description: 'Overwatch-map: gamemode, locatie en afbeelding (via OverFast API)',
  options: [{ type: 3, name: 'naam', description: 'Naam van de map', required: true, autocomplete: true }],
};

export async function autocomplete({ focused = '' } = {}) {
  const q = String(focused).toLowerCase();
  const maps = await getMaps();
  return maps
    .filter((m) => m.name.toLowerCase().includes(q) || m.key.includes(q))
    .slice(0, 25)
    .map((m) => ({ name: `${m.name} (${m.gamemodes.join(', ')})`, value: m.key }));
}

export async function run({ opties = {} } = {}) {
  const naam = opties.naam;
  const map = await resolveMap(naam);
  if (!map) return { content: `Geen map gevonden voor "${naam}".` };

  const gamemodes = await getGamemodes();
  const namen = map.gamemodes.map((key) => gamemodes.find((g) => g.key === key)?.name ?? key);

  return {
    embeds: [
      {
        color: KLEUR,
        title: map.name,
        image: map.screenshot ? { url: map.screenshot } : undefined,
        fields: [
          { name: 'Gamemode', value: namen.join(', ') || 'onbekend', inline: true },
          {
            name: 'Locatie',
            value: map.location ? `${map.location}${map.country_code ? ` (${map.country_code})` : ''}` : 'onbekend',
            inline: true,
          },
          { name: 'Types', value: (map.uses ?? []).join(', ') || 'onbekend', inline: true },
        ],
        footer: { text: 'Bron: OverFast API (community-scrape van Blizzard-data)' },
      },
    ],
  };
}

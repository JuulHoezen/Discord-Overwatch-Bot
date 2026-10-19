import { getHero, getHeroes, resolveHero } from '../lib/overfast.js';
import { KLEUR } from '../lib/embed.js';
import { kort } from '../lib/format.js';

export const definition = {
  name: 'hero',
  description: 'Overwatch-hero: rol, hitpoints en abilities (via OverFast API)',
  options: [
    { type: 3, name: 'naam', description: 'Naam van de hero', required: true, autocomplete: true },
  ],
};

const ROLLEN = { tank: 'Tank', damage: 'Damage', support: 'Support' };

export async function autocomplete({ focused = '' } = {}) {
  const q = String(focused).toLowerCase();
  const heroes = await getHeroes();
  return heroes
    .filter((h) => h.name.toLowerCase().includes(q) || h.key.includes(q))
    .slice(0, 25)
    .map((h) => ({ name: `${h.name} (${ROLLEN[h.role] ?? h.role})`, value: h.key }));
}

export async function run({ opties = {} } = {}) {
  const naam = opties.naam;
  const basis = await resolveHero(naam);
  if (!basis) return { content: `Geen hero gevonden voor "${naam}".` };

  const hero = await getHero(basis.key);
  const hp = hero.hitpoints
    ? [
        hero.hitpoints.health && `${hero.hitpoints.health} health`,
        hero.hitpoints.armor && `${hero.hitpoints.armor} armor`,
        hero.hitpoints.shields && `${hero.hitpoints.shields} shields`,
        `totaal ${hero.hitpoints.total}`,
      ]
        .filter(Boolean)
        .join(', ')
    : 'onbekend';

  const fields = [
    { name: 'Rol', value: ROLLEN[hero.role] ?? hero.role ?? 'onbekend', inline: true },
    { name: 'Subrol', value: hero.subrole ?? 'geen', inline: true },
    { name: 'Hitpoints', value: hp, inline: true },
  ];

  if (hero.abilities?.length) {
    fields.push({
      name: 'Abilities',
      value: kort(
        hero.abilities
          .slice(0, 6)
          .map((a) => `**${a.name}** - ${(a.description ?? '').split('.')[0]}`)
          .join('\n'),
      ),
    });
  }
  if (hero.perks?.length) {
    fields.push({ name: 'Perks', value: kort(hero.perks.map((p) => p.name ?? p).slice(0, 4).join(', ')) });
  }

  return {
    embeds: [
      {
        color: KLEUR,
        title: hero.name ?? basis.name,
        thumbnail: basis.portrait ? { url: basis.portrait } : undefined,
        fields,
        footer: { text: 'Bron: OverFast API (community-scrape van Blizzard-data)' },
      },
    ],
  };
}

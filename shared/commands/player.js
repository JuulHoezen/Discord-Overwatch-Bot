import { searchPlayer, getPlayer } from '../lib/overfast.js';
import { KLEUR } from '../lib/embed.js';
import { seizoenOpNummer } from '../lib/season.js';
import { duurNL } from '../lib/format.js';

export const definition = {
  name: 'player',
  description: 'Overwatch-spelerprofiel en ranks (via OverFast API)',
  options: [
    { type: 3, name: 'battletag', description: 'BattleTag of spelersnaam, bv. Naam-1234', required: true },
  ],
};

const ROLLEN = { tank: 'Tank', damage: 'Damage', support: 'Support', open: 'Open Queue' };

function rankTekst(rank) {
  if (!rank) return 'geen rank bekend';
  return `${rank.division} ${rank.tier}`;
}

export async function run({ opties = {} } = {}) {
  const ingevoerd = String(opties.battletag ?? '').trim();
  const gevonden = await searchPlayer(ingevoerd);

  if (!gevonden.total) {
    return {
      content:
        `Geen speler gevonden voor "${ingevoerd}". Let op: de BattleTag moet bestaan en het ` +
        'Blizzard-profiel moet openbaar ("Public") staan; anders kan de OverFast API er niets van zien.',
    };
  }

  const exact = gevonden.results.find((r) => r.player_id.toLowerCase() === ingevoerd.toLowerCase());
  const speler = exact ?? gevonden.results[0];
  const s = await getPlayer(speler.player_id);

  const fields = [];
  if (s.endorsement?.level != null) {
    fields.push({ name: 'Endorsement', value: `level ${s.endorsement.level}`, inline: true });
  }

  const platform = s.competitive?.pc ? 'pc' : s.competitive?.console ? 'console' : null;
  const comp = platform ? s.competitive[platform] : null;

  if (comp) {
    fields.push({
      name: `Competitive (${platform})`,
      value: Object.entries(comp)
        .filter(([k]) => ROLLEN[k])
        .map(([k, v]) => `${ROLLEN[k]}: ${rankTekst(v)}`)
        .join('\n'),
    });

    if (comp.season != null) {
      const arcSeizoen = Number.isFinite(comp.season) ? await seizoenOpNummer(comp.season - 20).catch(() => null) : null;
      const toelichting = arcSeizoen
        ? `komt overeen met ${arcSeizoen.title} in de arc (afgeleid: Blizzard-nummer - 20)`
        : 'seizoensnummer uit het Blizzard-profiel; geen overeenkomstig arc-seizoen in de dataset (afgeleid)';
      fields.push({ name: 'Seizoen volgens profiel', value: `seizoen ${comp.season} - ${toelichting}` });
    }
  } else {
    fields.push({ name: 'Competitive', value: 'geen competitive-gegevens in het profiel' });
  }

  const voet = s.last_updated_at
    ? `Bron: OverFast API - profieldata van Blizzard, bijgewerkt ${duurNL(Date.now() - s.last_updated_at * 1000)} geleden (kan verouderd zijn)`
    : 'Bron: OverFast API - profieldata van Blizzard';

  return {
    embeds: [
      {
        color: KLEUR,
        title: `${s.username}${s.title ? ` - ${s.title}` : ''}`,
        thumbnail: s.avatar ? { url: s.avatar } : undefined,
        fields,
        footer: { text: voet },
      },
    ],
  };
}

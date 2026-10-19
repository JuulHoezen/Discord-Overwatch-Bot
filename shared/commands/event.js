import { huidigSeizoen, seizoenOpNummer } from '../lib/season.js';
import { bronVoet, eventsTekst, startLabel, eindLabel, KLEUR } from '../lib/embed.js';
import { kort } from '../lib/format.js';

export const definition = {
  name: 'event',
  description: 'Overwatch-events: welke events horen bij welk seizoen',
  options: [
    { type: 4, name: 'seizoen', description: 'Seizoensnummer binnen de huidige arc', min_value: 1, max_value: 30 },
    { type: 5, name: 'alles', description: 'Toon de events van alle seizoenen in de arc' },
  ],
};

export async function run({ opties = {}, nu = new Date() } = {}) {
  const nummer = opties.seizoen ?? null;
  const alles = opties.alles === true;
  const { huidig, data } = await huidigSeizoen(nu);

  const teTonen = alles ? data.seasons : [nummer ? await seizoenOpNummer(nummer) : huidig].filter(Boolean);

  if (!teTonen.length) {
    return {
      content: `Geen seizoen gevonden voor nummer ${nummer}. De dataset bevat seizoen 1 t/m ${data.seasons.length}.`,
    };
  }

  if (!alles && !teTonen[0].events?.length) {
    const s = teTonen[0];
    return {
      content:
        `Voor **${s.title}** vermeldt de bron nog geen events.\n` +
        `Dit seizoen loopt van ${startLabel(s)} tot ${eindLabel(s)}.\n\n` +
        'Gebruik `/event alles:True` voor de events van alle seizoenen in deze arc. ' +
        'Let op: de Overwatch Wiki publiceert lang niet voor elk event een datum; waar die ontbreekt zegt de bot dat erbij.',
    };
  }

  if (alles) {
    return {
      embeds: [
        {
          color: KLEUR,
          title: `${data.arc.name} - alle events`,
          fields: data.seasons.slice(0, 25).map((s) => ({
            name: s.title,
            value: kort(
              s.events?.length
                ? eventsTekst(s.events)
                : `geen events vermeld (seizoen loopt ${startLabel(s)} t/m ${eindLabel(s)})`,
            ),
          })),
          footer: { text: bronVoet(data, { extra: 'eventdatums zijn vaak niet gepubliceerd' }) },
        },
      ],
    };
  }

  return {
    embeds: [
      {
        color: KLEUR,
        title: `Events in ${teTonen[0].title}`,
        description: eventsTekst(teTonen[0].events),
        footer: { text: bronVoet(data, { extra: 'eventdatums zijn vaak niet gepubliceerd' }) },
      },
    ],
  };
}

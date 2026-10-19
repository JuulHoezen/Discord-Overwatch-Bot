import { laadSeizoenen, seizoenStatus } from '../lib/season.js';
import { bronVoet, statusTekst, startLabel, eindLabel, KLEUR } from '../lib/embed.js';
import { kort } from '../lib/format.js';

export const definition = {
  name: 'seasons',
  description: 'Alle seizoenen van de huidige Overwatch-arc met looptijd en status',
};

export async function run({ nu = new Date() } = {}) {
  const data = await laadSeizoenen();

  const beschrijving = data.seasons
    .map((s) => {
      const status = seizoenStatus(s, nu);
      const markering = status.dagenTotStart <= 0 && status.dagenTotEind >= 0 ? ' <- nu' : '';
      return `**${s.title}**\n${startLabel(s)} t/m ${eindLabel(s)} - ${statusTekst(status)}${markering}`;
    })
    .join('\n\n');

  return {
    embeds: [
      {
        color: KLEUR,
        title: `${data.arc.name} - seizoenen ${data.arc.year}`,
        description: kort(beschrijving, 4096),
        footer: { text: bronVoet(data) },
      },
    ],
  };
}

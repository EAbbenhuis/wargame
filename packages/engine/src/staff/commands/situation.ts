import type { StaffCommand } from '../types.ts';
import { pct } from '../analysis.ts';

const SIDE = { blue: 'wij', red: 'de vijand' } as const;

export const situation: StaffCommand = {
  id: 'situatie',
  title: 'Situatie',
  example: 'Hoe staan we ervoor?',
  keywords: ['situatie', 'hoe staan', 'stand', 'overzicht', 'status', 'samenvatting'],
  run(view) {
    const objectives = view.objectives
      .map(
        (o) =>
          `${o.id} ${o.name}: ${o.controller ? SIDE[o.controller === view.side ? 'blue' : 'red'] : 'niemand'}`,
      )
      .join('; ');
    const held = view.objectives.filter((o) => o.controller === view.side).length;
    const text = [
      `Beurt ${view.turn} van ${view.maxTurns}. Onze sterkte: ${pct(view.strength.own, view.strength.ownStart)} van het begin.`,
      `Doelen: ${objectives}.`,
      `We zien nu ${view.enemies.length} vijandelijke eenheden; van ${view.lastSeen.length} weten we alleen waar ze eerder stonden.`,
      held >= 2
        ? 'We bezitten genoeg doelen. Houd ze vast en beperk verliezen.'
        : `We hebben nog ${2 - held} doel(en) nodig. Vraag "maak een plan om doel B te nemen".`,
    ].join(' ');
    return { text, proposals: [] };
  },
};

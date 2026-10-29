import type { StaffCommand } from '../types.ts';
import { attackOptions } from '../analysis.ts';

export const attack: StaffCommand = {
  id: 'aanvallen',
  title: 'Aanvalskansen',
  example: 'Welke aanvallen hebben goede kansen?',
  keywords: ['aanval', 'aanvallen', 'kansen', 'kans', 'toeslaan'],
  run(view) {
    const options = attackOptions(view);
    const good: typeof options = [];
    const used = new Set<string>();
    for (const o of options) {
      if (o.odds.ratio < 1.4 || used.has(o.unit.id)) continue;
      used.add(o.unit.id);
      good.push(o);
      if (good.length === 3) break;
    }
    if (good.length === 0) {
      return {
        text:
          options.length === 0
            ? 'Er is deze beurt geen vijand binnen bereik van een aanval.'
            : 'Geen enkele aanval heeft deze beurt goede kansen (minimaal 3:2). Overweeg artillerie of breng eerst meer eenheden bij elkaar.',
        proposals: [],
      };
    }
    return {
      text: `Deze aanvallen hebben de beste kansen: ${good.map((o) => `${o.unit.name} op ${o.enemy.name} (${o.odds.column})`).join('; ')}.`,
      proposals: good.map((o) => o.proposal),
    };
  },
};

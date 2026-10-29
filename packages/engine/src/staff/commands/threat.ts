import { hexDistance } from '../../hex/hex.ts';
import type { StaffCommand } from '../types.ts';
import { hexLabel, typeName } from '../analysis.ts';

export const threat: StaffCommand = {
  id: 'dreiging',
  title: 'Dreiging',
  example: 'Waar komt de vijand vandaan?',
  keywords: ['dreiging', 'gevaar', 'bedreig', 'vijand', 'tegenaanval', 'waar is'],
  run(view) {
    const known = [
      ...view.enemies.map((e) => ({ type: e.type, hex: e.hex, note: 'nu gezien' })),
      ...view.lastSeen.map((s) => ({
        type: s.type,
        hex: s.hex,
        note: `laatst gezien in beurt ${s.turn}`,
      })),
    ];
    if (known.length === 0)
      return {
        text: 'We weten niets over de vijand. Verkennen is nu het belangrijkst.',
        proposals: [],
      };
    const nearUs = known
      .map((k) => ({
        ...k,
        distance: Math.min(...view.ownUnits.map((u) => hexDistance(u.hex, k.hex))),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
    return {
      text:
        'Dichtstbijzijnde bekende vijanden: ' +
        nearUs
          .map(
            (k) =>
              `${typeName(view, k.type).toLowerCase()} ${hexLabel(view, k.hex)} (${k.note}, ${k.distance} hex van ons)`,
          )
          .join('; ') +
        '. Eenheden die in de verdediging moeten, kunnen de order "verdedigen" krijgen.',
      proposals: [],
    };
  },
};

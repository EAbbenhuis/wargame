import { hexDistance, hexKey } from '../../hex/hex.ts';
import type { StaffCommand, StaffProposal } from '../types.ts';

export const defend: StaffCommand = {
  id: 'verdedigen',
  title: 'Verdedigen',
  example: 'Hoe houden we onze doelen vast?',
  keywords: ['verdedig', 'vasthouden', 'houden', 'ingraven', 'graaf', 'stand houden'],
  run(view) {
    const proposals: StaffProposal[] = [];
    for (const unit of view.ownUnits) {
      const onObjective = view.objectives.some(
        (o) => o.controller === view.side && hexKey(o.hex) === hexKey(unit.hex),
      );
      const threatened = view.enemies.some((e) => hexDistance(e.hex, unit.hex) <= 2);
      if (onObjective || threatened) {
        proposals.push({
          intent: { kind: 'defend', unitId: unit.id },
          reason: onObjective ? 'staat op een eigen doel: ingraven' : 'vijand dichtbij: ingraven',
        });
      }
    }
    return {
      text:
        proposals.length > 0
          ? `Advies: ${proposals.length} eenheden ingraven (verdediging x1,5 deze beurt).`
          : 'Geen eenheden die nu direct bedreigd worden of op een eigen doel staan.',
      proposals,
    };
  },
};

import { hexDistance, hexKey } from '../../hex/hex.ts';
import { unitTypeOf } from '../../rules/map.ts';
import { reachablePaths } from '../../rules/movement.ts';
import type { StaffCommand, StaffProposal } from '../types.ts';

export const recon: StaffCommand = {
  id: 'verkennen',
  title: 'Verkennen',
  example: 'Waar moeten we verkennen?',
  keywords: ['verken', 'verkennen', 'verkenning', 'zicht', 'kijken', 'informatie'],
  run(view) {
    const visible = new Set(view.visible);
    const scouts = view.ownUnits.filter((u) => unitTypeOf(view.catalog, u).vision >= 4);
    const proposals: StaffProposal[] = [];
    for (const scout of scouts) {
      // Doel waar we het minst van zien.
      const target = [...view.objectives].sort(
        (a, b) => Number(visible.has(hexKey(a.hex))) - Number(visible.has(hexKey(b.hex))),
      )[0];
      if (!target) continue;
      let best = null as null | { hex: typeof scout.hex; score: number };
      for (const info of reachablePaths(view, scout.id).values()) {
        const nearEnemy = view.enemies.some((e) => hexDistance(e.hex, info.hex) <= 1);
        const score = -hexDistance(info.hex, target.hex) - (nearEnemy ? 10 : 0);
        if (hexDistance(info.hex, target.hex) < 3) continue; // niet te dichtbij: verkenning is zwak
        if (!best || score > best.score) best = { hex: info.hex, score };
      }
      if (best)
        proposals.push({
          intent: { kind: 'move', unitId: scout.id, to: best.hex },
          reason: `zicht op ${target.name}`,
        });
    }
    return {
      text:
        proposals.length > 0
          ? 'Verkenning vooruit om zicht te krijgen op de doelen, buiten bereik van de vijand.'
          : 'We hebben geen verkenningseenheden meer. Andere eenheden zien minder ver.',
      proposals,
    };
  },
};

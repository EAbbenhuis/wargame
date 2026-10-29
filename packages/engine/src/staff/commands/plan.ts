import type { StaffCommand } from '../types.ts';
import { findObjective, planForObjective } from '../analysis.ts';

export const plan: StaffCommand = {
  id: 'plan-doel',
  title: 'Plan voor een doel',
  example: 'Maak een plan om doel B te nemen.',
  keywords: ['plan', 'nemen', 'neem', 'veroveren', 'verover', 'innemen', 'bezetten'],
  run(view, question) {
    const objective =
      findObjective(view, question) ??
      // Geen doel genoemd: het dichtstbijzijnde doel dat we nog niet hebben.
      view.objectives.find((o) => o.controller !== view.side);
    if (!objective) {
      return { text: 'We bezitten alle doelen al. Advies: vasthouden en ingraven.', proposals: [] };
    }
    const proposals = planForObjective(view, objective);
    if (proposals.length === 0) {
      return {
        text: `Ik zie deze beurt geen zinvolle zetten richting ${objective.name}.`,
        proposals: [],
      };
    }
    const owner =
      objective.controller === view.side
        ? 'al van ons'
        : objective.controller
          ? 'in vijandelijke handen'
          : 'van niemand';
    return {
      text:
        `Plan voor doel ${objective.id} (${objective.name}, ${owner}): ${proposals.length} orders. ` +
        'Controleer de pijlen op de kaart en neem over wat u wilt. De vijand beweegt tegelijk: houd rekening met een tegenstoot.',
      proposals,
    };
  },
};

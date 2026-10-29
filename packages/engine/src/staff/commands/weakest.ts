import type { StaffCommand } from '../types.ts';
import { enemyDefense, fmt, hexLabel, typeName } from '../analysis.ts';

export const weakest: StaffCommand = {
  id: 'zwakste-plek',
  title: 'Zwakste plek',
  example: 'Waar is de vijand het zwakst?',
  keywords: ['zwak', 'zwakst', 'zwakste', 'kwetsbaar', 'gat'],
  run(view) {
    if (view.enemies.length === 0) {
      return {
        text: 'We zien op dit moment geen vijandelijke eenheden. Stuur de verkenning vooruit om de vijand te vinden.',
        proposals: [],
      };
    }
    const sorted = [...view.enemies].sort(
      (a, b) => enemyDefense(view, a) - enemyDefense(view, b) || (a.id < b.id ? -1 : 1),
    );
    const lines = sorted
      .slice(0, 3)
      .map(
        (e) =>
          `${typeName(view, e.type)} ${hexLabel(view, e.hex)}, sterkte ${e.strength}, verdediging ${fmt(enemyDefense(view, e))}`,
      );
    return {
      text:
        `Zwakste vijandelijke eenheden die we zien: ${lines.join('; ')}. ` +
        'Let op: wat we niet zien, kunnen we niet beoordelen, en de vijand beweegt tegelijk met ons.',
      proposals: [],
    };
  },
};

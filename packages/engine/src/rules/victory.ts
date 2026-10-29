// UITSLAG
//
// Punten per kant = waarde van de doelen die je bezit
//                 + victory.pointsPerStrength x de sterkte die de tegenstander verloren heeft.
// Wie minstens `victory.margin` punten meer heeft, wint. Anders is het onbeslist.
// Beide getallen staan per scenario in data/scenarios/.

import type { GameState, Outcome, Side } from '../types.ts';
import { aliveUnits } from './map.ts';

const SIDE_NAME: Record<Side, string> = { blue: 'Blauw', red: 'Rood' };

export function currentStrength(state: GameState, side: Side): number {
  return aliveUnits(state.units)
    .filter((u) => u.side === side)
    .reduce((sum, u) => sum + u.strength, 0);
}

export function computeScore(state: GameState): Record<Side, number> {
  const lost = (side: Side) => state.startStrength[side] - currentStrength(state, side);
  const objectives = (side: Side) =>
    state.objectives.filter((o) => o.controller === side).reduce((sum, o) => sum + o.value, 0);
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    blue: round(objectives('blue') + state.victory.pointsPerStrength * lost('red')),
    red: round(objectives('red') + state.victory.pointsPerStrength * lost('blue')),
  };
}

export function computeOutcome(state: GameState): Outcome {
  const score = computeScore(state);
  const diff = score.blue - score.red;
  const winner: Side | null =
    diff >= state.victory.margin ? 'blue' : -diff >= state.victory.margin ? 'red' : null;
  const held = (side: Side) =>
    state.objectives
      .filter((o) => o.controller === side)
      .map((o) => o.name)
      .join(', ') || 'geen doelen';
  const summary =
    (winner ? `${SIDE_NAME[winner]} wint` : 'Onbeslist') +
    ` (${score.blue} tegen ${score.red} punten). Blauw bezit: ${held('blue')}. Rood bezit: ${held('red')}.`;
  return { winner, score, summary };
}

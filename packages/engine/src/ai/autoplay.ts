// Laat de computer beurten spelen voor een kant die normaal door een mens gespeeld wordt.
// Gebruikt door het debugmenu ("spring naar beurt N") en door tests en balanssimulaties.
import { applyAction } from '../game.ts';
import type { GameState, Side } from '../types.ts';
import { getPlayerView } from '../view.ts';
import { planOrders } from './opponent.ts';

export function autoPlayTurn(
  state: GameState,
  side: Side = 'blue',
  posture = 'balanced',
): GameState {
  if (state.phase === 'ended') return state;
  let current = state;
  const orders = planOrders(getPlayerView(current, side), posture);
  for (const [unitId, order] of Object.entries(orders)) {
    const result = applyAction(current, { type: 'setOrder', side, unitId, order });
    if (result.ok) current = result.state;
  }
  const other: Side = side === 'blue' ? 'red' : 'blue';
  current = applyAction(current, { type: 'endTurn', side }).state;
  if (!current.ready[other] && current.turn === state.turn && current.phase !== 'ended') {
    // De andere kant is ook een mens: laat de computer die ook spelen.
    return autoPlayTurn(current, other, posture);
  }
  return current;
}

/** Speel door tot het begin van `turn` (of tot het einde van het spel). */
export function autoPlayUntil(
  state: GameState,
  turn: number,
  side: Side = 'blue',
  posture = 'balanced',
): GameState {
  let current = state;
  while (current.phase !== 'ended' && current.turn < turn)
    current = autoPlayTurn(current, side, posture);
  return current;
}

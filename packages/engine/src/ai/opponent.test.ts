import { describe, expect, it } from 'vitest';
import { POSTURES } from '../data/index.ts';
import { applyAction, createGame } from '../game.ts';
import { validateOrder } from '../rules/orders.ts';
import { at, testGame, unit } from '../testing/fixtures.ts';
import type { GameState, Side } from '../types.ts';
import { getPlayerView } from '../view.ts';
import { autoPlayTurn } from './autoplay.ts';
import { planOrders } from './opponent.ts';

/** Speel een heel spel computer tegen computer en controleer elke order onderweg. */
function playChecked(
  seed: number,
  posture: string,
): { state: GameState; invalid: string[]; orders: number } {
  let state = createGame({
    scenario: 'grensbrug',
    seed,
    controllers: { blue: { kind: 'human' }, red: { kind: 'human' } },
  });
  const invalid: string[] = [];
  let orders = 0;
  while (state.phase !== 'ended') {
    for (const side of ['blue', 'red'] as Side[]) {
      const view = getPlayerView(state, side);
      for (const [unitId, order] of Object.entries(planOrders(view, posture))) {
        orders += 1;
        const error = validateOrder(view, unitId, order);
        if (error) invalid.push(`beurt ${state.turn} ${unitId}: ${error}`);
        const result = applyAction(state, { type: 'setOrder', side, unitId, order });
        if (result.ok) state = result.state;
      }
    }
    state = applyAction(applyAction(state, { type: 'endTurn', side: 'blue' }).state, {
      type: 'endTurn',
      side: 'red',
    }).state;
  }
  return { state, invalid, orders };
}

describe('AI-tegenstander', () => {
  it(
    'doet in volledige spellen alleen geldige orders, voor elke houding',
    { timeout: 20_000 },
    () => {
      for (const posture of POSTURES) {
        for (const seed of [1, 2]) {
          const { invalid, orders } = playChecked(seed, posture.id);
          expect(invalid).toEqual([]);
          expect(orders).toBeGreaterThan(0);
        }
      }
    },
  );

  it('is deterministisch: dezelfde seed geeft hetzelfde spel', () => {
    expect(playChecked(5, 'balanced').state).toEqual(playChecked(5, 'balanced').state);
  });

  it('speelt een heel spel uit tot een uitslag', () => {
    const { state } = playChecked(9, 'aggressive');
    expect(state.phase).toBe('ended');
    expect(state.outcome).not.toBeNull();
  });

  it('kijkt niet achter de fog of war: een onzichtbare vijand verandert zijn plan niet', () => {
    const base = [unit('r1', 'red', 'infantry', 3, 3), unit('b1', 'blue', 'infantry', 5, 3)];
    const objectives = [
      { id: 'A', name: 'Doel', col: 3, row: 3, value: 3, controller: 'red' as const },
    ];
    const without = testGame({ units: base, objectives });
    const withHidden = testGame({
      units: [...base, unit('b-hidden', 'blue', 'armor', 9, 7)],
      objectives,
    });
    expect(planOrders(getPlayerView(withHidden, 'red'), 'balanced')).toEqual(
      planOrders(getPlayerView(without, 'red'), 'balanced'),
    );
  });

  it('valt in de aanvallende houding een zwakke vijand aan, en graaft in de verdedigende houding in op een doel', () => {
    const units = [unit('r1', 'red', 'armor', 3, 3), unit('b1', 'blue', 'recon', 4, 3)];
    const objectives = [
      { id: 'A', name: 'Doel', col: 3, row: 3, value: 3, controller: 'red' as const },
    ];
    const state = testGame({ units, objectives });
    state.units.b1!.strength = 4;
    const view = getPlayerView(state, 'red');
    expect(planOrders(view, 'aggressive').r1?.kind).toBe('attack');
    const defensive = testGame({
      units: [unit('r1', 'red', 'infantry', 3, 3), unit('b1', 'blue', 'armor', 5, 3)],
      objectives,
    });
    expect(planOrders(getPlayerView(defensive, 'red'), 'defensive').r1).toEqual({ kind: 'defend' });
  });

  it('trekt naar doelen die hij nog niet bezit', () => {
    const objectives = [{ id: 'A', name: 'Doel', col: 8, row: 3, value: 3, controller: null }];
    const state = testGame({
      units: [unit('b1', 'blue', 'armor', 1, 3), unit('r1', 'red', 'infantry', 9, 7)],
      objectives,
    });
    const next = autoPlayTurn(state, 'blue');
    const before = Math.abs(1 - 8);
    const after = Math.abs(
      next.units.b1!.hex.q + (next.units.b1!.hex.r - (next.units.b1!.hex.r & 1)) / 2 - 8,
    );
    expect(after).toBeLessThan(before);
    expect(at(1, 3)).toBeDefined();
  });
});

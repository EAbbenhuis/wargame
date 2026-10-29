// Tests naar aanleiding van een onafhankelijke review: elk beschrijft een fout die eerst
// niet door de tests gevangen werd.
import { describe, expect, it } from 'vitest';
import { applyAction, replay } from '../game.ts';
import { hexDistance, hexKey } from '../hex/hex.ts';
import { at, openMap, testGame, unit } from '../testing/fixtures.ts';
import type { GameState, Order, Side } from '../types.ts';
import { getPlayerView, observeEvent } from '../view.ts';
import { canSee } from './vision.ts';

function order(state: GameState, side: Side, unitId: string, o: Order): GameState {
  const result = applyAction(state, { type: 'setOrder', side, unitId, order: o });
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
const endTurn = (s: GameState) =>
  replay(s, [
    { type: 'endTurn', side: 'blue' },
    { type: 'endTurn', side: 'red' },
  ]);

describe('door eigen eenheden heen bewegen bij het uitvoeren', () => {
  it('laat een eenheid door een stilstaande eigen eenheid heen trekken', () => {
    let state = testGame({
      units: [
        unit('b1', 'blue', 'infantry', 1, 3),
        unit('b2', 'blue', 'infantry', 2, 3),
        unit('r1', 'red', 'infantry', 9, 7),
      ],
    });
    state = order(state, 'blue', 'b1', { kind: 'move', path: [at(2, 3), at(3, 3)] });
    state = endTurn(state);
    expect(state.units.b1!.hex).toEqual(at(3, 3));
    expect(state.units.b2!.hex).toEqual(at(2, 3));
  });

  it('zet een eenheid die stopt op de hex van een eigen eenheid terug, zodat nooit twee eenheden op één hex staan', () => {
    let state = testGame({
      units: [
        unit('b1', 'blue', 'armor', 1, 3),
        unit('b2', 'blue', 'armor', 2, 3),
        unit('r1', 'red', 'armor', 5, 3),
      ],
    });
    state = order(state, 'blue', 'b1', { kind: 'move', path: [at(2, 3), at(3, 3), at(4, 3)] });
    state = order(state, 'red', 'r1', { kind: 'move', path: [at(4, 3), at(3, 3)] });
    state = endTurn(state);
    const keys = Object.values(state.units).map((u) => hexKey(u.hex));
    expect(new Set(keys).size).toBe(keys.length);
    expect(state.units.b1!.hex).toEqual(at(1, 3));
  });
});

describe('fog of war in het beurtverslag', () => {
  it('verraadt niet welke onzichtbare artillerie op ons vuurde', () => {
    let state = testGame({
      units: [
        unit('b1', 'blue', 'armor', 1, 1),
        unit('r-rec', 'red', 'recon', 4, 1),
        unit('r-art', 'red', 'artillery', 3, 4),
      ],
    });
    state = order(state, 'red', 'r-art', { kind: 'fire', target: at(1, 1) });
    state = endTurn(state);
    const view = getPlayerView(state, 'blue');
    expect(view.lastTurnEvents.some((e) => e.type === 'fire')).toBe(true);
    expect(JSON.stringify(view)).not.toContain('r-art');
  });

  it('toont niet waarheen een vijand terugtrok als die hex niet te zien is', () => {
    const visible = new Set([hexKey(at(2, 3))]);
    const seen = observeEvent(
      { type: 'retreat', unitId: 'r1', side: 'red', from: at(2, 3), to: at(3, 3) },
      'blue',
      visible,
      false,
    );
    expect(seen).toMatchObject({ type: 'retreat', to: null, toHidden: true });
  });
});

describe('zichtlijnen', () => {
  it('zijn symmetrisch: als A B ziet, ziet B ook A (gelijke zichtafstand, vlak terrein)', () => {
    const map = openMap(10, 8);
    map[1] = '..B...B...';
    map[3] = '...BB.....';
    map[5] = '.B....B.B.';
    const state = testGame({ map, units: [unit('b1', 'blue', 'infantry', 0, 0)] });
    const cells: [number, number][] = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 10; c++) if (map[r]![c] === '.') cells.push([c, r]);
    let asymmetric = 0;
    for (const [c1, r1] of cells) {
      for (const [c2, r2] of cells) {
        const a = {
          id: 'a',
          side: 'blue' as const,
          type: 'infantry',
          name: 'a',
          hex: at(c1, r1),
          strength: 10,
        };
        const b = { ...a, id: 'b', hex: at(c2, r2) };
        if (hexDistance(a.hex, b.hex) > 3) continue;
        if (canSee(state, a, b.hex) !== canSee(state, b, a.hex)) asymmetric += 1;
      }
    }
    expect(asymmetric).toBe(0);
  });
});

describe('sterkere controles op bestaande regels', () => {
  it('ontmoeting: twee vijanden die dezelfde hex willen, stoppen allebei met contact', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'armor', 1, 3), unit('r1', 'red', 'armor', 7, 3)],
    });
    state = order(state, 'blue', 'b1', {
      kind: 'move',
      path: [at(2, 3), at(3, 3), at(4, 3), at(5, 3)],
    });
    state = order(state, 'red', 'r1', {
      kind: 'move',
      path: [at(6, 3), at(5, 3), at(4, 3), at(3, 3)],
    });
    state = endTurn(state);
    const halted = state.history.at(-1)!.events.filter((e) => e.type === 'halted');
    expect(halted.map((e) => e.type === 'halted' && e.reason)).toEqual(['contact', 'contact']);
    // Beide wilden (4,3) in: ze staan er allebei één hex vandaan.
    expect(hexDistance(state.units.b1!.hex, at(4, 3))).toBe(1);
    expect(hexDistance(state.units.r1!.hex, at(4, 3))).toBe(1);
  });

  it('terugtrekken: de verdediger gaat verder van de aanvaller af staan', () => {
    for (let seed = 1; seed < 50; seed++) {
      let state = testGame(
        { units: [unit('b1', 'blue', 'armor', 1, 3), unit('r1', 'red', 'recon', 2, 3)] },
        { seed },
      );
      state = order(state, 'blue', 'b1', { kind: 'attack', path: [], targetId: 'r1' });
      state = endTurn(state);
      const retreat = state.history.at(-1)!.events.find((e) => e.type === 'retreat');
      if (retreat?.type === 'retreat' && retreat.to && state.units.r1) {
        expect(hexDistance(retreat.to, at(1, 3))).toBeGreaterThan(
          hexDistance(retreat.from, at(1, 3)),
        );
        return;
      }
    }
    throw new Error('Geen terugtrekking gevonden');
  });

  it('ingegraven verdediging telt mee in het echte gevecht', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'armor', 1, 3), unit('r1', 'red', 'infantry', 2, 3)],
    });
    state = order(state, 'blue', 'b1', { kind: 'attack', path: [], targetId: 'r1' });
    state = order(state, 'red', 'r1', { kind: 'defend' });
    state = endTurn(state);
    const combat = state.history.at(-1)!.events.find((e) => e.type === 'combat');
    expect(combat?.type === 'combat' && combat.defense).toBe(7.5);
  });

  it('een voorsprong kleiner dan de marge is onbeslist', () => {
    const objectives = [
      { id: 'A', name: 'Klein', col: 5, row: 3, value: 1, controller: 'blue' as const },
    ];
    let state = testGame({
      objectives,
      maxTurns: 1,
      units: [unit('b1', 'blue', 'armor', 1, 3), unit('r1', 'red', 'infantry', 9, 7)],
    });
    state = endTurn(state);
    expect(state.outcome?.score).toEqual({ blue: 1, red: 0 });
    expect(state.outcome?.winner).toBeNull();
  });
});

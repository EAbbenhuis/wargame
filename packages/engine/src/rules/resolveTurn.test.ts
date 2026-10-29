import { describe, expect, it } from 'vitest';
import { applyAction, replay } from '../game.ts';
import { hexKey } from '../hex/hex.ts';
import { at, openMap, testGame, unit } from '../testing/fixtures.ts';
import type { GameAction, GameState, Order, Side } from '../types.ts';

function order(state: GameState, side: Side, unitId: string, o: Order): GameState {
  const result = applyAction(state, { type: 'setOrder', side, unitId, order: o });
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function endTurn(state: GameState): GameState {
  return replay(state, [
    { type: 'endTurn', side: 'blue' },
    { type: 'endTurn', side: 'red' },
  ]);
}

const events = (state: GameState) => state.history.at(-1)!.events;

describe('beurt uitvoeren: beide kanten tegelijk', () => {
  it('voert pas uit als beide kanten klaar zijn', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'infantry', 1, 1), unit('r1', 'red', 'infantry', 8, 6)],
    });
    state = order(state, 'blue', 'b1', { kind: 'move', path: [at(2, 1)] });
    state = applyAction(state, { type: 'endTurn', side: 'blue' }).state;
    expect(state.turn).toBe(1);
    expect(state.units.b1!.hex).toEqual(at(1, 1));
    state = applyAction(state, { type: 'endTurn', side: 'red' }).state;
    expect(state.turn).toBe(2);
    expect(state.units.b1!.hex).toEqual(at(2, 1));
  });

  it('weigert nieuwe orders als een kant al klaar is', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'infantry', 1, 1), unit('r1', 'red', 'infantry', 8, 6)],
    });
    state = applyAction(state, { type: 'endTurn', side: 'blue' }).state;
    const result = applyAction(state, {
      type: 'setOrder',
      side: 'blue',
      unitId: 'b1',
      order: { kind: 'defend' },
    });
    expect(result.ok).toBe(false);
  });

  it('beweegt eenheden van beide kanten tegelijk', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'infantry', 0, 0), unit('r1', 'red', 'infantry', 9, 7)],
    });
    state = order(state, 'blue', 'b1', { kind: 'move', path: [at(1, 0), at(2, 0)] });
    state = order(state, 'red', 'r1', { kind: 'move', path: [at(8, 7), at(7, 7)] });
    state = endTurn(state);
    expect(state.units.b1!.hex).toEqual(at(2, 0));
    expect(state.units.r1!.hex).toEqual(at(7, 7));
  });

  it('laat vijanden die naar dezelfde hex willen allebei stoppen (ontmoeting)', () => {
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
    const b = state.units.b1!.hex;
    const r = state.units.r1!.hex;
    expect(hexKey(b)).not.toBe(hexKey(r));
    // Ze stoppen bij het eerste contact: naast elkaar.
    expect(Math.abs(b.q - r.q) + Math.abs(b.r - r.r)).toBeLessThanOrEqual(2);
    expect(events(state).filter((e) => e.type === 'halted')).toHaveLength(2);
  });

  it('laat eigen eenheden die dezelfde hex willen niet botsen: de eerste gaat, de tweede wacht', () => {
    let state = testGame({
      units: [
        unit('b1', 'blue', 'infantry', 1, 1),
        unit('b2', 'blue', 'infantry', 3, 1),
        unit('r1', 'red', 'infantry', 9, 7),
      ],
    });
    state = order(state, 'blue', 'b1', { kind: 'move', path: [at(2, 1)] });
    state = order(state, 'blue', 'b2', { kind: 'move', path: [at(2, 1)] });
    state = endTurn(state);
    expect(state.units.b1!.hex).toEqual(at(2, 1));
    expect(state.units.b2!.hex).toEqual(at(3, 1));
  });

  it('stopt een eenheid die onverwacht naast een vijand komt', () => {
    // Rood staat buiten zicht en loopt blauw in de weg.
    let state = testGame({
      map: openMap(14, 8),
      units: [unit('b1', 'blue', 'recon', 0, 3), unit('r1', 'red', 'infantry', 6, 1)],
    });
    state = order(state, 'blue', 'b1', {
      kind: 'move',
      path: [at(1, 3), at(2, 3), at(3, 3), at(4, 3), at(5, 3), at(6, 3)],
    });
    state = order(state, 'red', 'r1', { kind: 'move', path: [at(6, 2)] });
    state = endTurn(state);
    expect(state.units.b1!.hex).toEqual(at(5, 3));
    expect(
      events(state).some((e) => e.type === 'halted' && e.unitId === 'b1' && e.reason === 'contact'),
    ).toBe(true);
  });
});

describe('beurt uitvoeren: gevecht', () => {
  it('voert een aanval uit op een vijand die na de beweging naast de aanvaller staat', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'armor', 2, 3), unit('r1', 'red', 'infantry', 4, 3)],
    });
    state = order(state, 'blue', 'b1', { kind: 'attack', path: [at(3, 3)], targetId: 'r1' });
    state = endTurn(state);
    const combat = events(state).find((e) => e.type === 'combat');
    expect(combat).toBeDefined();
    if (combat?.type === 'combat') {
      const r1Strength = state.units.r1?.strength ?? 0;
      expect(r1Strength).toBe(10 - combat.defenderLoss);
      expect(state.units.b1!.strength).toBe(10 - combat.attackerLoss);
    }
  });

  it('blaast een aanval af als het doelwit is weggetrokken', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'infantry', 1, 3), unit('r1', 'red', 'infantry', 2, 3)],
    });
    state = order(state, 'blue', 'b1', { kind: 'attack', path: [], targetId: 'r1' });
    state = order(state, 'red', 'r1', { kind: 'move', path: [at(3, 3), at(4, 3)] });
    state = endTurn(state);
    expect(events(state).some((e) => e.type === 'attackCancelled')).toBe(true);
    expect(state.units.r1!.strength).toBe(10);
  });

  it('laat een verdediger terugtrekken als de tabel dat zegt', () => {
    // Zoek een seed waarbij de aanval een terugtrekking oplevert.
    for (let seed = 1; seed < 50; seed++) {
      let state = testGame(
        { units: [unit('b1', 'blue', 'armor', 1, 3), unit('r1', 'red', 'recon', 2, 3)] },
        { seed },
      );
      state = order(state, 'blue', 'b1', { kind: 'attack', path: [], targetId: 'r1' });
      state = endTurn(state);
      const combat = events(state).find((e) => e.type === 'combat');
      if (combat?.type === 'combat' && combat.retreat && state.units.r1) {
        expect(state.units.r1.hex).not.toEqual(at(2, 3));
        expect(events(state).some((e) => e.type === 'retreat' && e.unitId === 'r1')).toBe(true);
        return;
      }
    }
    throw new Error('Geen seed gevonden met een terugtrekking');
  });

  it('vernietigt een eenheid zonder sterkte', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'armor', 1, 3), unit('r1', 'red', 'logistics', 2, 3)],
    });
    state.units.r1!.strength = 1;
    state = order(state, 'blue', 'b1', { kind: 'attack', path: [], targetId: 'r1' });
    state = endTurn(state);
    expect(state.units.r1).toBeUndefined();
    expect(state.destroyed.r1).toBeDefined();
    expect(events(state).some((e) => e.type === 'destroyed' && e.unitId === 'r1')).toBe(true);
  });

  it('vuurt artillerie af vóór de beweging, op de hex waar de vijand dan staat', () => {
    let state = testGame({
      units: [unit('b-art', 'blue', 'artillery', 1, 3), unit('r1', 'red', 'infantry', 3, 3)],
    });
    state = order(state, 'blue', 'b-art', { kind: 'fire', target: at(3, 3) });
    state = order(state, 'red', 'r1', { kind: 'move', path: [at(4, 3)] });
    state = endTurn(state);
    const fire = events(state).find((e) => e.type === 'fire');
    expect(fire?.type === 'fire' && fire.targetUnitId).toBe('r1');
    if (fire?.type === 'fire') expect(state.units.r1!.strength).toBe(10 - fire.damage);
  });

  it('beschermt eenheden in de stad tegen artillerie (dekking)', () => {
    const map = openMap();
    map[3] = '...S......';
    const damage = (m: string[]) => {
      const results: number[] = [];
      for (let seed = 1; seed <= 30; seed++) {
        let state = testGame(
          {
            map: m,
            units: [unit('b-art', 'blue', 'artillery', 1, 3), unit('r1', 'red', 'infantry', 3, 3)],
          },
          { seed },
        );
        state = order(state, 'blue', 'b-art', { kind: 'fire', target: at(3, 3) });
        state = endTurn(state);
        results.push(10 - (state.units.r1?.strength ?? 0));
      }
      return results.reduce((a, b) => a + b, 0);
    };
    expect(damage(map)).toBeLessThan(damage(openMap()));
  });

  it('herstelt eenheden naast logistiek met 1 sterktepunt', () => {
    let state = testGame({
      units: [
        unit('b1', 'blue', 'infantry', 1, 3),
        unit('b-log', 'blue', 'logistics', 2, 3),
        unit('r1', 'red', 'infantry', 9, 7),
      ],
    });
    state.units.b1!.strength = 6;
    state = endTurn(state);
    expect(state.units.b1!.strength).toBe(7);
  });
});

describe('doelen en einde van het spel', () => {
  const objectives = [
    { id: 'A', name: 'Brug', col: 5, row: 3, value: 3, controller: 'red' as const },
  ];

  it('neemt een doel in door er aan het eind van de beurt op te staan', () => {
    let state = testGame({
      objectives,
      units: [unit('b1', 'blue', 'armor', 2, 3), unit('r1', 'red', 'infantry', 9, 7)],
    });
    state = order(state, 'blue', 'b1', { kind: 'move', path: [at(3, 3), at(4, 3), at(5, 3)] });
    state = endTurn(state);
    expect(state.objectives[0]!.controller).toBe('blue');
    expect(events(state).some((e) => e.type === 'captured' && e.side === 'blue')).toBe(true);
  });

  it('houdt een doel in bezit als de eenheid weer weggaat', () => {
    let state = testGame({
      objectives,
      units: [unit('b1', 'blue', 'armor', 5, 3), unit('r1', 'red', 'infantry', 9, 7)],
    });
    state = endTurn(state);
    expect(state.objectives[0]!.controller).toBe('blue');
    state = order(state, 'blue', 'b1', { kind: 'move', path: [at(4, 3)] });
    state = endTurn(state);
    expect(state.objectives[0]!.controller).toBe('blue');
  });

  it('eindigt na het laatste beurt met een uitslag op basis van doelen en verliezen', () => {
    let state = testGame({
      objectives,
      maxTurns: 2,
      units: [unit('b1', 'blue', 'armor', 5, 3), unit('r1', 'red', 'infantry', 9, 7)],
    });
    state = endTurn(state);
    expect(state.phase).toBe('planning');
    state = endTurn(state);
    expect(state.phase).toBe('ended');
    expect(state.outcome?.winner).toBe('blue');
    expect(state.outcome?.score.blue).toBe(3);
    expect(applyAction(state, { type: 'endTurn', side: 'blue' }).ok).toBe(false);
  });

  it('eindigt onbeslist als het verschil kleiner is dan de marge', () => {
    let state = testGame({
      maxTurns: 1,
      units: [unit('b1', 'blue', 'armor', 5, 3), unit('r1', 'red', 'infantry', 9, 7)],
    });
    state = endTurn(state);
    expect(state.outcome?.winner).toBeNull();
  });

  it('eindigt meteen als een kant geen eenheden meer heeft', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'armor', 1, 3), unit('r1', 'red', 'logistics', 2, 3)],
    });
    state.units.r1!.strength = 1;
    state = order(state, 'blue', 'b1', { kind: 'attack', path: [], targetId: 'r1' });
    state = endTurn(state);
    expect(state.phase).toBe('ended');
    expect(state.outcome?.winner).toBe('blue');
  });
});

describe('determinisme', () => {
  const setup = () =>
    testGame({
      units: [
        unit('b1', 'blue', 'armor', 1, 3),
        unit('b2', 'blue', 'artillery', 1, 4),
        unit('r1', 'red', 'infantry', 3, 3),
        unit('r2', 'red', 'infantry', 4, 4),
      ],
    });
  const actions: GameAction[] = [
    {
      type: 'setOrder',
      side: 'blue',
      unitId: 'b1',
      order: { kind: 'attack', path: [at(2, 3)], targetId: 'r1' },
    },
    { type: 'setOrder', side: 'blue', unitId: 'b2', order: { kind: 'fire', target: at(3, 3) } },
    { type: 'endTurn', side: 'blue' },
    { type: 'endTurn', side: 'red' },
    { type: 'endTurn', side: 'blue' },
    { type: 'endTurn', side: 'red' },
  ];

  it('geeft met dezelfde seed en acties precies dezelfde eindtoestand', () => {
    expect(replay(setup(), actions)).toEqual(replay(setup(), actions));
  });

  it('verandert de oude toestand nooit', () => {
    const start = setup();
    const copy = structuredClone(start);
    replay(start, actions);
    expect(start).toEqual(copy);
  });
});

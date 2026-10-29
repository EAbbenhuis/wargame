// Drones: een vliegende verkenner. Beweegt over elk terrein voor 1 punt per hex, ziet 6 hexen ver,
// kijkt over bos, stad en heuvels heen, kan niet aanvallen en houdt geen doel bezet.
import { describe, expect, it } from 'vitest';
import { applyAction, createGame, replay } from '../game.ts';
import { hexKey } from '../hex/hex.ts';
import { summarizeForModel } from '../staff/prompt.ts';
import { at, openMap, testGame, unit } from '../testing/fixtures.ts';
import { getPlayerView } from '../view.ts';
import { reachableHexes } from './movement.ts';
import { visibleHexes } from './vision.ts';

const endTurn = (state: Parameters<typeof replay>[0]) =>
  replay(state, [
    { type: 'endTurn', side: 'blue' },
    { type: 'endTurn', side: 'red' },
  ]);

describe('drone', () => {
  it('beweegt 8 hexen over elk terrein, ook over een rivier, bos en heuvels', () => {
    // Rij 2: open, dan bos, rivier, heuvel, stad, rivier ... alles kost een drone 1 punt.
    const map = openMap(12, 6);
    map[2] = '.B~HS~B~H...';
    const state = testGame({
      map,
      units: [unit('d1', 'blue', 'drone', 0, 2), unit('r1', 'red', 'infantry', 11, 5)],
    });
    const reach = reachableHexes(getPlayerView(state, 'blue'), 'd1');
    // Recht naar rechts over rij 2: 8 hexen = 8 punten.
    expect(reach.get(hexKey(at(8, 2)))?.cost).toBe(8);
    expect(reach.has(hexKey(at(9, 2)))).toBe(false);
  });

  it('ziet 6 hexen ver', () => {
    const state = testGame({
      map: openMap(12, 6),
      units: [unit('d1', 'blue', 'drone', 0, 2)],
    });
    const visible = visibleHexes(state, 'blue');
    expect(visible.has(hexKey(at(6, 2)))).toBe(true);
    expect(visible.has(hexKey(at(7, 2)))).toBe(false);
  });

  it('kijkt over bos, stad en heuvels heen (verkenning op de grond niet)', () => {
    const map = openMap(12, 6);
    map[2] = '.BSH........';
    const drone = testGame({ map, units: [unit('d1', 'blue', 'drone', 0, 2)] });
    const seenByDrone = visibleHexes(drone, 'blue');
    expect(seenByDrone.has(hexKey(at(4, 2)))).toBe(true);
    expect(seenByDrone.has(hexKey(at(6, 2)))).toBe(true);

    const recon = testGame({ map, units: [unit('v1', 'blue', 'recon', 0, 2)] });
    expect(visibleHexes(recon, 'blue').has(hexKey(at(4, 2)))).toBe(false);
  });

  it('kan niet aanvallen', () => {
    const state = testGame({
      units: [unit('d1', 'blue', 'drone', 2, 2), unit('r1', 'red', 'infantry', 3, 2)],
    });
    const result = applyAction(state, {
      type: 'setOrder',
      side: 'blue',
      unitId: 'd1',
      order: { kind: 'attack', path: [], targetId: 'r1' },
    });
    expect(result.ok).toBe(false);
  });

  it('neemt geen doel in, ook niet als hij erop staat', () => {
    let state = testGame({
      units: [unit('d1', 'blue', 'drone', 1, 2), unit('r1', 'red', 'infantry', 9, 7)],
      objectives: [
        { id: 'A', name: 'Doel A', col: 2, row: 2, value: 3, controller: null },
        { id: 'B', name: 'Doel B', col: 3, row: 2, value: 3, controller: 'red' },
      ],
    });
    // Eerst op doel A (van niemand), de beurt erna op doel B (van rood).
    state = applyAction(state, {
      type: 'setOrder',
      side: 'blue',
      unitId: 'd1',
      order: { kind: 'move', path: [at(2, 2)] },
    }).state;
    state = endTurn(state);
    expect(state.units.d1!.hex).toEqual(at(2, 2));
    expect(state.objectives.find((o) => o.id === 'A')!.controller).toBe(null);

    state = applyAction(state, {
      type: 'setOrder',
      side: 'blue',
      unitId: 'd1',
      order: { kind: 'move', path: [at(3, 2)] },
    }).state;
    state = endTurn(state);
    expect(state.units.d1!.hex).toEqual(at(3, 2));
    expect(state.objectives.find((o) => o.id === 'B')!.controller).toBe('red');
    expect(state.history.flatMap((t) => t.events).some((e) => e.type === 'captured')).toBe(false);
  });

  it('het taalmodel van de staf hoort dat de drone niet aanvalt en geen doel inneemt', () => {
    const view = getPlayerView(createGame({ scenario: 'grensbrug', seed: 1 }), 'blue');
    const own = summarizeForModel(view)
      .split('\n')
      .find((line) => line.startsWith('Eigen eenheden:'))!;
    const units = JSON.parse(own.slice('Eigen eenheden:'.length)) as Record<string, unknown>[];
    const drone = units.find((u) => u.id === 'b-uav-1')!;
    expect(drone.kanNietAanvallen).toBe(true);
    expect(drone.neemtGeenDoelIn).toBe(true);
    const infantry = units.find((u) => u.id === 'b-inf-1')!;
    expect(infantry.kanNietAanvallen).toBeUndefined();
    expect(infantry.neemtGeenDoelIn).toBeUndefined();
  });

  it('blauw heeft in Operatie Grensbrug precies één drone, rood geen', () => {
    const state = createGame({ scenario: 'grensbrug', seed: 1 });
    const drones = Object.values(state.units).filter((u) => u.type === 'drone');
    expect(drones.map((u) => u.side)).toEqual(['blue']);
  });
});

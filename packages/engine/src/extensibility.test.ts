// Bewijs dat de engine uit te breiden is via alleen packages/engine/src/data/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { planOrders } from './ai/opponent.ts';
import { TERRAINS, UNIT_TYPES } from './data/index.ts';
import { applyAction, createGame, replay } from './game.ts';
import { hexKey } from './hex/hex.ts';
import { reachableHexes } from './rules/movement.ts';
import { visibleHexes } from './rules/vision.ts';
import { at, testScenario, unit } from './testing/fixtures.ts';
import type { UnitType } from './types.ts';
import { getPlayerView } from './view.ts';

const ROOT = join(import.meta.dirname, '..', '..');

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : files(full, ext);
    return ext.test(name) && !name.includes('.test.') ? [full] : [];
  });
}

/** Zo zou iemand een drone toevoegen: één object in data/unitTypes.ts. */
const DRONE: UnitType = {
  id: 'drone',
  name: 'Drone',
  short: 'UAV',
  description: 'Onbemand vliegtuigje: ziet ver, vecht niet.',
  movement: 8,
  movementClass: 'air',
  attack: 0,
  defense: 1,
  maxStrength: 4,
  vision: 6,
  fireRange: 0,
  firepower: 0,
  supplyRange: 0,
  icon: [{ kind: 'text', x: 50, y: 30, text: 'UAV', size: 9 }],
};

describe('uitbreidbaarheid via data/', () => {
  afterEach(() => {
    const i = UNIT_TYPES.findIndex((t) => t.id === 'drone');
    if (i >= 0) UNIT_TYPES.splice(i, 1);
  });

  it('een nieuw eenheidstype werkt na alleen een toevoeging aan data/unitTypes.ts', () => {
    UNIT_TYPES.push(DRONE); // hetzelfde effect als een object toevoegen in data/unitTypes.ts
    const map = ['..........', '...BBB....', '...BBB....', '..........'];
    let state = createGame({
      seed: 3,
      scenario: testScenario({
        map,
        units: [
          unit('b-uav', 'blue', 'drone', 0, 3),
          unit('b-inf', 'blue', 'infantry', 0, 0),
          unit('r1', 'red', 'infantry', 8, 2),
        ],
      }),
      controllers: { blue: { kind: 'human' }, red: { kind: 'ai', posture: 'aggressive' } },
    });
    // Beweging: onbekende bewegingsklasse 'air' gebruikt de standaardkosten uit terrains.ts.
    const reach = reachableHexes(getPlayerView(state, 'blue'), 'b-uav');
    expect(reach.size).toBeGreaterThan(10);
    // Zicht: 6 hexen.
    expect(visibleHexes(state, 'blue').has(hexKey(at(6, 3)))).toBe(true);
    // De AI kan ermee plannen en de beurt loopt door.
    expect(() => planOrders(getPlayerView(state, 'blue'), 'balanced')).not.toThrow();
    state = applyAction(state, {
      type: 'setOrder',
      side: 'blue',
      unitId: 'b-uav',
      order: { kind: 'move', path: [at(1, 3), at(2, 3)] },
    }).state;
    state = replay(state, [{ type: 'endTurn', side: 'blue' }]);
    expect(state.turn).toBe(2);
    expect(state.units['b-uav']!.hex).toEqual(at(2, 3));
    // Kan niet aanvallen (attack: 0): de engine weigert.
    expect(
      applyAction(state, {
        type: 'setOrder',
        side: 'blue',
        unitId: 'b-uav',
        order: { kind: 'attack', path: [], targetId: 'r1' },
      }).ok,
    ).toBe(false);
  });

  it('geen code buiten data/ noemt een eenheidstype of terrein bij naam (engine en web-app)', () => {
    const ids = [...UNIT_TYPES.map((t) => t.id), ...TERRAINS.map((t) => t.id)];
    const sources = [
      ...files(join(ROOT, 'engine', 'src'), /\.ts$/).filter(
        (f) => !f.includes(`${join('src', 'data')}`) && !f.includes('testing'),
      ),
      ...files(join(ROOT, 'web', 'src'), /\.tsx?$/),
    ];
    expect(sources.length).toBeGreaterThan(20);
    const offenders: string[] = [];
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const id of ids) {
        if (new RegExp(`['"\`]${id}['"\`]`).test(text))
          offenders.push(`${relative(ROOT, file)}: '${id}'`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

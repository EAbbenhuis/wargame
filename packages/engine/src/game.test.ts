import { describe, expect, it } from 'vitest';
import { SCENARIOS } from './data/index.ts';
import { createGame } from './game.ts';
import { testScenario, unit } from './testing/fixtures.ts';

describe('een spel aanmaken', () => {
  it('laadt elk scenario uit data/scenarios zonder fouten', () => {
    for (const scenario of SCENARIOS) {
      const state = createGame({ scenario: scenario.id, seed: 7 });
      expect(state.turn).toBe(1);
      expect(Object.keys(state.units)).toHaveLength(scenario.units.length);
      expect(state.map.terrain).toHaveLength(state.map.cols * state.map.rows);
    }
  });

  it('heeft in Operatie Grensbrug een brigade van 6 tot 9 eenheden per kant, op een kaart van 20 bij 14', () => {
    const state = createGame({ scenario: 'grensbrug' });
    const count = (side: string) =>
      Object.values(state.units).filter((u) => u.side === side).length;
    expect(count('blue')).toBeGreaterThanOrEqual(6);
    expect(count('blue')).toBeLessThanOrEqual(9);
    expect(count('red')).toBeGreaterThanOrEqual(6);
    expect(state.map.cols).toBe(20);
    expect(state.map.rows).toBe(14);
  });

  it('geeft een begrijpelijke fout bij een onbekend terreinteken', () => {
    const scenario = testScenario({ map: ['..X.'], units: [unit('b1', 'blue', 'infantry', 0, 0)] });
    expect(() => createGame({ scenario })).toThrow(/onbekend terreinteken 'X'/);
  });

  it('geeft een begrijpelijke fout bij een onbekend eenheidstype', () => {
    const scenario = testScenario({ units: [unit('b1', 'blue', 'onbekend', 0, 0)] });
    expect(() => createGame({ scenario })).toThrow(/Onbekend eenheidstype 'onbekend'/);
  });

  it('weigert twee eenheden op dezelfde hex', () => {
    const scenario = testScenario({
      units: [unit('b1', 'blue', 'infantry', 0, 0), unit('b2', 'blue', 'infantry', 0, 0)],
    });
    expect(() => createGame({ scenario })).toThrow(/dezelfde hex/);
  });
});

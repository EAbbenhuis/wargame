import { describe, expect, it } from 'vitest';
import { at, openMap } from '../testing/fixtures.ts';
import { createGame } from '../game.ts';
import { combatResult, computeOdds, type Combatant } from './combat.ts';
import { testScenario, unit } from '../testing/fixtures.ts';

function board(map: string[]) {
  return createGame({
    scenario: testScenario({ map, units: [unit('x', 'blue', 'infantry', 0, 0)] }),
  });
}

const c = (type: string, col: number, row: number, strength = 10): Combatant => ({
  type,
  hex: at(col, row),
  strength,
});

describe('gevecht', () => {
  const open = board(openMap());

  it('vergelijkt aanval en verdediging: infanterie tegen infanterie op open terrein is 4 tegen 5', () => {
    const odds = computeOdds({
      ...open,
      attacker: c('infantry', 1, 1),
      defender: c('infantry', 2, 1),
    });
    expect(odds.attack).toBe(4);
    expect(odds.defense).toBe(5);
    expect(odds.column).toBe('1:1');
  });

  it('laat terrein de verdediging versterken (stad x2)', () => {
    const map = openMap();
    map[1] = '..S.......';
    const odds = computeOdds({
      ...board(map),
      attacker: c('armor', 1, 1),
      defender: c('infantry', 2, 1),
    });
    expect(odds.defense).toBe(10);
    expect(odds.column).toBe('1:2');
    expect(odds.notes.join(' ')).toMatch(/stad/i);
  });

  it('maakt ingegraven eenheden sterker', () => {
    const odds = computeOdds({
      ...open,
      attacker: c('armor', 1, 1),
      defender: c('infantry', 2, 1),
      defenderDefending: true,
    });
    expect(odds.defense).toBe(7.5);
  });

  it('schaalt met sterkte: een half bataljon valt half zo hard aan', () => {
    const odds = computeOdds({
      ...open,
      attacker: c('armor', 1, 1, 5),
      defender: c('infantry', 2, 1),
    });
    expect(odds.attack).toBe(3.5);
  });

  it('geeft een kolom extra bij een aanval uit meerdere richtingen (flank)', () => {
    const base = computeOdds({
      ...open,
      attacker: c('armor', 1, 1),
      defender: c('infantry', 2, 1),
    });
    const flanked = computeOdds({
      ...open,
      attacker: c('armor', 1, 1),
      defender: c('infantry', 2, 1),
      supporters: [c('infantry', 3, 1)],
    });
    expect(flanked.columnIndex).toBe(base.columnIndex + 1);
  });

  it('geeft een kolom minder als de aanvaller in de rivier staat', () => {
    const map = openMap();
    map[1] = '.~........';
    const odds = computeOdds({
      ...board(map),
      attacker: c('infantry', 1, 1),
      defender: c('infantry', 2, 1),
    });
    expect(odds.column).toBe('1:2');
  });

  it('leest het resultaat uit de tabel met de worp', () => {
    const odds = computeOdds({
      ...open,
      attacker: c('armor', 1, 1),
      defender: c('infantry', 2, 1),
    });
    expect(odds.column).toBe('3:2'); // 7 : 5 = 1,4
    expect(combatResult(odds, 6)).toEqual({ attacker: 0, defender: 4, retreat: true });
    expect(combatResult(odds, 1)).toEqual({ attacker: 2, defender: 1, retreat: false });
  });
});

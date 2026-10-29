import { describe, expect, it } from 'vitest';
import { hexKey } from '../hex/hex.ts';
import { at, openMap, testGame, unit } from '../testing/fixtures.ts';
import { getPlayerView } from '../view.ts';
import { findPath, reachableHexes } from './movement.ts';

const reach = (state: ReturnType<typeof testGame>, unitId: string) =>
  reachableHexes(getPlayerView(state, 'blue'), unitId);

describe('beweging met terreinkosten', () => {
  it('laat infanterie (3 punten) 3 hexen ver over open terrein lopen, niet 4', () => {
    const state = testGame({ units: [unit('b1', 'blue', 'infantry', 1, 3)] });
    const r = reach(state, 'b1');
    expect(r.has(hexKey(at(4, 3)))).toBe(true);
    expect(r.has(hexKey(at(5, 3)))).toBe(false);
  });

  it('laat bos 2 punten kosten voor infanterie', () => {
    const map = openMap();
    map[3] = '..BB......';
    const state = testGame({ map, units: [unit('b1', 'blue', 'infantry', 1, 3)] });
    const r = reach(state, 'b1');
    expect(r.get(hexKey(at(2, 3)))?.cost).toBe(2);
    // Twee bos-hexen achter elkaar: 2 + 2 = 4 punten, meer dan infanterie heeft.
    expect(r.has(hexKey(at(3, 3)))).toBe(false);
  });

  it('laat pantser niet door een rivier, wel over een brug', () => {
    const map = ['...~......', '...~......', '...=......', '...~......'];
    const state = testGame({ map, units: [unit('b1', 'blue', 'armor', 2, 0)] });
    const r = reach(state, 'b1');
    expect(r.has(hexKey(at(3, 0)))).toBe(false);
    expect(r.has(hexKey(at(3, 2)))).toBe(true);
    expect(findPath(getPlayerView(state, 'blue'), 'b1', at(4, 2))).not.toBeNull();
  });

  it('laat infanterie een rivier in waden voor een hele beurt (3 punten)', () => {
    const map = ['...~......', '...~......', '...~......'];
    const state = testGame({ map, units: [unit('b1', 'blue', 'infantry', 2, 1)] });
    const r = reach(state, 'b1');
    expect(r.get(hexKey(at(3, 1)))?.cost).toBe(3);
    expect(r.has(hexKey(at(4, 1)))).toBe(false);
  });

  it('kan niet door een bekende vijand heen, en stopt naast een vijand (contact)', () => {
    // Verkenning (b-rec) zorgt dat blauw de vijand ziet.
    const state = testGame({
      units: [
        unit('b1', 'blue', 'armor', 1, 3),
        unit('b-rec', 'blue', 'recon', 1, 6),
        unit('r1', 'red', 'infantry', 4, 3),
      ],
    });
    const r = reach(state, 'b1');
    expect(r.has(hexKey(at(4, 3)))).toBe(false);
    // Naast de vijand mag je komen...
    expect(r.has(hexKey(at(3, 3)))).toBe(true);
    // ...maar niet er langs: (5,3) ligt achter de vijand en kan alleen via aangrenzende hexen.
    expect(r.has(hexKey(at(5, 3)))).toBe(false);
  });

  it('eindigt niet op een hex waar al een eigen eenheid staat, maar mag er wel doorheen', () => {
    const state = testGame({
      units: [unit('b1', 'blue', 'infantry', 1, 3), unit('b2', 'blue', 'infantry', 2, 3)],
    });
    const r = reach(state, 'b1');
    expect(r.has(hexKey(at(2, 3)))).toBe(false);
    expect(r.has(hexKey(at(3, 3)))).toBe(true);
  });

  it('vindt het goedkoopste pad om bos heen', () => {
    const map = openMap();
    map[3] = '..BB......';
    // Pantser: bos kost 3. Rechtdoor = 3 + 3 + 1 = 7 punten, eromheen = 4.
    const state = testGame({ map, units: [unit('b1', 'blue', 'armor', 1, 3)] });
    const path = findPath(getPlayerView(state, 'blue'), 'b1', at(4, 3));
    expect(path).not.toBeNull();
    expect(path!.map(hexKey)).not.toContain(hexKey(at(2, 3)));
    expect(path!.map(hexKey)).not.toContain(hexKey(at(3, 3)));
    expect(path).toHaveLength(4);
  });
});

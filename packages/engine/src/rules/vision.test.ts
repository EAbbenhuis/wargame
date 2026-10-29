import { describe, expect, it } from 'vitest';
import { hexKey } from '../hex/hex.ts';
import { at, openMap, testGame, unit } from '../testing/fixtures.ts';
import { getPlayerView } from '../view.ts';
import { visibleHexes } from './vision.ts';

describe('zicht en fog of war', () => {
  it('ziet hexen binnen de zichtafstand en niet daarbuiten', () => {
    // Infanterie ziet 3 hexen ver.
    const state = testGame({ units: [unit('b1', 'blue', 'infantry', 2, 2)] });
    const visible = visibleHexes(state, 'blue');
    expect(visible.has(hexKey(at(5, 2)))).toBe(true);
    expect(visible.has(hexKey(at(6, 2)))).toBe(false);
  });

  it('laat verkenning verder kijken dan infanterie', () => {
    const state = testGame({ units: [unit('b1', 'blue', 'recon', 0, 2)] });
    const visible = visibleHexes(state, 'blue');
    expect(visible.has(hexKey(at(5, 2)))).toBe(true);
    expect(visible.has(hexKey(at(6, 2)))).toBe(false);
  });

  it('kan niet door bos heen kijken, maar ziet het bos zelf wel', () => {
    const map = openMap();
    map[2] = '...B......';
    const state = testGame({ map, units: [unit('b1', 'blue', 'infantry', 1, 2)] });
    const visible = visibleHexes(state, 'blue');
    expect(visible.has(hexKey(at(3, 2)))).toBe(true);
    expect(visible.has(hexKey(at(4, 2)))).toBe(false);
  });

  it('kijkt over een moeras heen', () => {
    const map = openMap();
    map[2] = '...M......';
    const state = testGame({ map, units: [unit('b1', 'blue', 'infantry', 1, 2)] });
    const visible = visibleHexes(state, 'blue');
    expect(visible.has(hexKey(at(3, 2)))).toBe(true);
    expect(visible.has(hexKey(at(4, 2)))).toBe(true);
  });

  it('kijkt vanaf een heuvel over bos heen, en verder', () => {
    const map = openMap(12, 8);
    map[2] = '.H.B........';
    const state = testGame({ map, units: [unit('b1', 'blue', 'infantry', 1, 2)] });
    const visible = visibleHexes(state, 'blue');
    expect(visible.has(hexKey(at(4, 2)))).toBe(true);
    // Zicht 3 + heuvelbonus 2 = 5.
    expect(visible.has(hexKey(at(6, 2)))).toBe(true);
    expect(visible.has(hexKey(at(7, 2)))).toBe(false);
  });

  it('toont in het spelersbeeld alleen vijanden die je ziet', () => {
    const state = testGame({
      units: [
        unit('b1', 'blue', 'infantry', 0, 0),
        unit('r-near', 'red', 'infantry', 2, 0),
        unit('r-far', 'red', 'infantry', 9, 7),
      ],
    });
    const view = getPlayerView(state, 'blue');
    expect(view.enemies.map((e) => e.id)).toEqual(['r-near']);
  });

  it('lekt geen informatie over onzichtbare vijanden in het spelersbeeld', () => {
    const state = testGame({
      units: [unit('b1', 'blue', 'infantry', 0, 0), unit('r-geheim', 'red', 'armor', 9, 7)],
    });
    const json = JSON.stringify(getPlayerView(state, 'blue'));
    expect(json).not.toContain('r-geheim');
    expect(json).not.toContain('"seed"');
    expect(json).not.toContain('"rng"');
  });

  it('kan de fog of war uitzetten (alleen voor het debugmenu)', () => {
    const state = testGame({
      units: [unit('b1', 'blue', 'infantry', 0, 0), unit('r-far', 'red', 'infantry', 9, 7)],
    });
    expect(getPlayerView(state, 'blue', { revealAll: true }).enemies).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { hexKey } from '../hex/hex.ts';
import { at, openMap, testGame, unit } from '../testing/fixtures.ts';
import { applyAction, replay } from '../game.ts';
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

  it('onthoudt waar een vijand het laatst gezien is, en vergeet dat als de plek leeg blijkt', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'recon', 0, 3), unit('r1', 'red', 'infantry', 4, 3)],
    });
    expect(getPlayerView(state, 'blue').enemies.map((e) => e.id)).toEqual(['r1']);
    // Rood trekt weg uit zicht.
    state = applyAction(state, {
      type: 'setOrder',
      side: 'red',
      unitId: 'r1',
      order: { kind: 'move', path: [at(5, 3), at(6, 3), at(7, 3)] },
    }).state;
    state = replay(state, [
      { type: 'endTurn', side: 'blue' },
      { type: 'endTurn', side: 'red' },
    ]);
    const view = getPlayerView(state, 'blue');
    expect(view.enemies).toEqual([]);
    // De oude plek (4,3) is nog in zicht en leeg: dus vergeten.
    expect(view.lastSeen).toEqual([]);
  });

  it('houdt een herinnering vast als de oude plek niet meer te zien is', () => {
    let state = testGame({
      units: [unit('b1', 'blue', 'recon', 0, 3), unit('r1', 'red', 'infantry', 4, 3)],
    });
    state = applyAction(state, {
      type: 'setOrder',
      side: 'blue',
      unitId: 'b1',
      order: { kind: 'move', path: [at(0, 4), at(0, 5), at(0, 6), at(0, 7)] },
    }).state;
    state = applyAction(state, {
      type: 'setOrder',
      side: 'red',
      unitId: 'r1',
      order: { kind: 'move', path: [at(5, 2), at(6, 1)] },
    }).state;
    state = replay(state, [
      { type: 'endTurn', side: 'blue' },
      { type: 'endTurn', side: 'red' },
    ]);
    const view = getPlayerView(state, 'blue');
    expect(view.enemies).toEqual([]);
    expect(view.lastSeen.map((s) => [s.unitId, s.turn])).toEqual([['r1', 1]]);
  });

  it('kan de fog of war uitzetten (alleen voor het debugmenu)', () => {
    const state = testGame({
      units: [unit('b1', 'blue', 'infantry', 0, 0), unit('r-far', 'red', 'infantry', 9, 7)],
    });
    expect(getPlayerView(state, 'blue', { revealAll: true }).enemies).toHaveLength(1);
  });
});

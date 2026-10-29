import { describe, expect, it } from 'vitest';
import { applyAction } from '../game.ts';
import { at, testGame, unit } from '../testing/fixtures.ts';
import { getPlayerView } from '../view.ts';
import { intentToOrder, validateOrder } from './orders.ts';

const units = [
  unit('b-inf', 'blue', 'infantry', 1, 3),
  unit('b-art', 'blue', 'artillery', 0, 5),
  unit('b-log', 'blue', 'logistics', 0, 1),
  unit('r-inf', 'red', 'infantry', 4, 3),
  unit('r-far', 'red', 'infantry', 9, 7),
];

describe('orders valideren', () => {
  const state = testGame({ units });
  const view = getPlayerView(state, 'blue');

  it('accepteert een geldige beweging', () => {
    expect(validateOrder(view, 'b-inf', { kind: 'move', path: [at(1, 2), at(1, 1)] })).toBeNull();
  });

  it('weigert een pad dat te veel bewegingspunten kost', () => {
    const error = validateOrder(view, 'b-inf', {
      kind: 'move',
      path: [at(1, 4), at(1, 5), at(1, 6), at(1, 7)],
    });
    expect(error).toMatch(/buiten bereik/i);
  });

  it('weigert een pad met sprongen', () => {
    expect(validateOrder(view, 'b-inf', { kind: 'move', path: [at(3, 3)] })).toMatch(/aansluit/i);
  });

  it('weigert orders voor eenheden van de tegenstander', () => {
    expect(validateOrder(view, 'r-inf', { kind: 'defend' })).toMatch(/niet van u/i);
  });

  it('weigert een aanval op een vijand die niet te zien is', () => {
    expect(validateOrder(view, 'b-inf', { kind: 'attack', path: [], targetId: 'r-far' })).toMatch(
      /niet zichtbaar/i,
    );
  });

  it('weigert een aanval als de eenheid na de beweging niet naast het doel staat', () => {
    expect(
      validateOrder(view, 'b-inf', { kind: 'attack', path: [at(2, 3)], targetId: 'r-inf' }),
    ).toMatch(/naast/i);
  });

  it('accepteert een aanval na beweging tot naast het doel', () => {
    expect(
      validateOrder(view, 'b-inf', {
        kind: 'attack',
        path: [at(2, 3), at(3, 3)],
        targetId: 'r-inf',
      }),
    ).toBeNull();
  });

  it('weigert aanvallen met een eenheid zonder aanvalswaarde', () => {
    expect(validateOrder(view, 'b-log', { kind: 'attack', path: [], targetId: 'r-inf' })).toMatch(
      /kan niet aanvallen/i,
    );
  });

  it('weigert indirect vuur buiten bereik en vuur door eenheden zonder artillerie', () => {
    expect(validateOrder(view, 'b-art', { kind: 'fire', target: at(5, 5) })).toMatch(/bereik/i);
    expect(validateOrder(view, 'b-inf', { kind: 'fire', target: at(3, 3) })).toMatch(
      /geen indirect vuur/i,
    );
  });

  it('weigert indirect vuur op een hex die je niet kunt zien', () => {
    const blind = testGame({ units: [unit('b-art', 'blue', 'artillery', 0, 5)] });
    // Artillerie ziet 2 ver, vuurt 3 ver: op 3 hexen afstand is het doel onzichtbaar.
    expect(
      validateOrder(getPlayerView(blind, 'blue'), 'b-art', { kind: 'fire', target: at(3, 5) }),
    ).toMatch(/niet zien/i);
  });
});

describe('voorstellen (intenties) omzetten naar orders', () => {
  const view = getPlayerView(testGame({ units }), 'blue');

  it('maakt van "ga naar" een order met het goedkoopste pad', () => {
    const result = intentToOrder(view, { kind: 'move', unitId: 'b-inf', to: at(3, 2) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order).toMatchObject({ kind: 'move' });
  });

  it('weigert een zet buiten bereik met een duidelijke reden', () => {
    const result = intentToOrder(view, { kind: 'move', unitId: 'b-inf', to: at(8, 0) });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/buiten bereik/i) });
  });

  it('kiest bij een aanval zelf een hex naast het doel', () => {
    const result = intentToOrder(view, { kind: 'attack', unitId: 'b-inf', targetId: 'r-inf' });
    expect(result.ok).toBe(true);
    if (result.ok && result.order.kind === 'attack') {
      expect(validateOrder(view, 'b-inf', result.order)).toBeNull();
    }
  });
});

describe('de engine weigert ongeldige acties', () => {
  it('laat de toestand ongemoeid bij een ongeldige order', () => {
    const state = testGame({ units });
    const result = applyAction(state, {
      type: 'setOrder',
      side: 'blue',
      unitId: 'b-inf',
      order: { kind: 'move', path: [at(1, 4), at(1, 5), at(1, 6), at(1, 7)] },
    });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(state.orders.blue).toEqual({});
  });
});

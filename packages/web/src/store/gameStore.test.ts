import { describe, expect, it } from 'vitest';
import { offsetToAxial } from '@wargame/engine';
import { createGameStore, currentView } from './gameStore.ts';

describe('game store (interface-toestand)', () => {
  it('start een spel met de gekozen seed en houding', () => {
    const store = createGameStore();
    store.getState().startGame({ seed: 42, posture: 'aggressive' });
    const { game, screen } = store.getState();
    expect(screen).toBe('game');
    expect(game?.seed).toBe(42);
    expect(game?.controllers.red).toEqual({ kind: 'ai', posture: 'aggressive' });
  });

  it('selecteert een eigen eenheid en geeft een bewegingsorder door op een hex te klikken', () => {
    const store = createGameStore();
    store.getState().startGame();
    const unit = currentView(store.getState())!.ownUnits.find((u) => u.id === 'b-inf-2')!;
    store.getState().clickHex(unit.hex);
    expect(store.getState().selectedUnitId).toBe('b-inf-2');
    store.getState().clickHex(offsetToAxial({ col: 6, row: 7 }));
    expect(store.getState().game!.orders.blue['b-inf-2']?.kind).toBe('move');
  });

  it('toont de reden als de engine een order weigert', () => {
    const store = createGameStore();
    store.getState().startGame();
    store.getState().selectUnit('b-inf-2');
    store.getState().clickHex(offsetToAxial({ col: 18, row: 2 }));
    expect(store.getState().notice?.text).toMatch(/buiten bereik/i);
    expect(store.getState().game!.orders.blue['b-inf-2']).toBeUndefined();
  });

  it('voert een beurt uit en houdt de lijst van acties bij', () => {
    const store = createGameStore();
    store.getState().startGame();
    store.getState().endTurn();
    expect(store.getState().game!.turn).toBe(2);
    expect(store.getState().actions).toEqual([{ type: 'endTurn', side: 'blue' }]);
    expect(store.getState().showReport).toBe(true);
  });

  it('springt via het debugmenu naar een latere beurt', () => {
    const store = createGameStore();
    store.getState().startGame();
    store.getState().jumpToTurn(5);
    expect(store.getState().game!.turn).toBe(5);
  });
});

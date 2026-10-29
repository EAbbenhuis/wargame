// De toestand van de web-app (Zustand).
//
// Afspraak: hier staan GEEN spelregels. De store bewaart de speltoestand die de engine teruggeeft,
// plus interface-zaken (wat is geselecteerd, welke melding staat er). Elke wijziging van het spel
// gaat via applyAction uit de engine. "Mag dit?" beslist altijd de engine.

import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import {
  applyAction,
  autoPlayUntil,
  createGame,
  getPlayerView,
  hexDistance,
  hexKey,
  intentToOrder,
  unitTypeOf,
  type ActionResult,
  type GameAction,
  type GameState,
  type Hex,
  type Order,
  type OrderIntent,
  type PlayerView,
} from '@wargame/engine';

export interface GameSetup {
  scenarioId: string;
  seed: number;
  posture: string;
}

export interface Notice {
  kind: 'error' | 'info';
  text: string;
}

export type Screen = 'start' | 'game' | 'end';

export interface GameStoreState {
  screen: Screen;
  setup: GameSetup;
  game: GameState | null;
  /** Alle acties sinds de start: hiermee is het spel na te spelen. */
  actions: GameAction[];
  selectedUnitId: string | null;
  notice: Notice | null;
  /** Debugmenu: fog of war uit. Alleen in development. */
  fogOff: boolean;
  /** Na een beurt: het verslag openklappen. */
  showReport: boolean;

  startGame: (setup?: Partial<GameSetup>) => void;
  dispatch: (action: GameAction) => ActionResult | null;
  selectUnit: (unitId: string | null) => void;
  clickHex: (hex: Hex) => void;
  giveOrder: (intent: OrderIntent) => boolean;
  setOrder: (unitId: string, order: Order) => boolean;
  clearOrder: (unitId: string) => void;
  endTurn: () => void;
  jumpToTurn: (turn: number) => void;
  setFogOff: (value: boolean) => void;
  setNotice: (notice: Notice | null) => void;
  closeReport: () => void;
  backToStart: () => void;
}

export const DEFAULT_SETUP: GameSetup = { scenarioId: 'grensbrug', seed: 1, posture: 'balanced' };

export function createGameStore(initial: Partial<GameSetup> = {}) {
  return createStore<GameStoreState>()((set, get) => ({
    screen: 'start',
    setup: { ...DEFAULT_SETUP, ...initial },
    game: null,
    actions: [],
    selectedUnitId: null,
    notice: null,
    fogOff: false,
    showReport: false,

    startGame: (overrides = {}) => {
      const setup = { ...get().setup, ...overrides };
      const game = createGame({
        scenario: setup.scenarioId,
        seed: setup.seed,
        controllers: { blue: { kind: 'human' }, red: { kind: 'ai', posture: setup.posture } },
      });
      set({
        screen: 'game',
        setup,
        game,
        actions: [],
        selectedUnitId: null,
        notice: null,
        showReport: false,
      });
    },

    dispatch: (action) => {
      const { game } = get();
      if (!game) return null;
      const result = applyAction(game, action);
      if (result.ok) {
        set({ game: result.state, actions: [...get().actions, action] });
      } else {
        set({ notice: { kind: 'error', text: result.error } });
      }
      return result;
    },

    selectUnit: (unitId) => set({ selectedUnitId: unitId, notice: null }),

    giveOrder: (intent) => {
      const view = currentView(get());
      if (!view) return false;
      const result = intentToOrder(view, intent);
      if (!result.ok) {
        set({ notice: { kind: 'error', text: result.error } });
        return false;
      }
      return get().setOrder(intent.unitId, result.order);
    },

    setOrder: (unitId, order) => {
      const result = get().dispatch({ type: 'setOrder', side: 'blue', unitId, order });
      if (result?.ok) set({ notice: null });
      return result?.ok ?? false;
    },

    clearOrder: (unitId) => {
      get().dispatch({ type: 'clearOrder', side: 'blue', unitId });
    },

    // Klikken op de kaart vertalen naar een voorstel. De engine beslist of het mag.
    clickHex: (hex) => {
      const state = get();
      const view = currentView(state);
      if (!view || view.phase === 'ended') return;
      const key = hexKey(hex);
      const own = view.ownUnits.find((u) => hexKey(u.hex) === key);
      const enemy = view.enemies.find((e) => hexKey(e.hex) === key);
      const selected = view.ownUnits.find((u) => u.id === state.selectedUnitId);

      if (!selected) {
        if (own) state.selectUnit(own.id);
        return;
      }
      if (own) {
        state.selectUnit(own.id === selected.id ? null : own.id);
        return;
      }
      if (enemy) {
        const type = unitTypeOf(view.catalog, selected);
        const distance = hexDistance(selected.hex, enemy.hex);
        const intent: OrderIntent =
          type.fireRange > 0 && distance <= type.fireRange
            ? { kind: 'fire', unitId: selected.id, target: enemy.hex }
            : { kind: 'attack', unitId: selected.id, targetId: enemy.id };
        state.giveOrder(intent);
        return;
      }
      state.giveOrder({ kind: 'move', unitId: selected.id, to: hex });
    },

    endTurn: () => {
      const before = get().game;
      const result = get().dispatch({ type: 'endTurn', side: 'blue' });
      const after = get().game;
      if (!result?.ok || !after || !before) return;
      set({
        selectedUnitId: null,
        showReport: true,
        screen: after.phase === 'ended' ? 'end' : 'game',
        notice: null,
      });
    },

    jumpToTurn: (turn) => {
      const { game } = get();
      if (!game) return;
      const next = autoPlayUntil(game, turn, 'blue', 'balanced');
      set({
        game: next,
        selectedUnitId: null,
        screen: next.phase === 'ended' ? 'end' : 'game',
        showReport: false,
      });
    },

    setFogOff: (value) => set({ fogOff: value }),
    setNotice: (notice) => set({ notice }),
    closeReport: () => set({ showReport: false }),
    backToStart: () =>
      set({ screen: 'start', game: null, actions: [], selectedUnitId: null, notice: null }),
  }));
}

export type GameStore = ReturnType<typeof createGameStore>;

/** Het spelersbeeld van blauw (met fog of war, tenzij het debugmenu die uitzet). */
export function currentView(state: Pick<GameStoreState, 'game' | 'fogOff'>): PlayerView | null {
  if (!state.game) return null;
  return getPlayerView(state.game, 'blue', { revealAll: state.fogOff });
}

export const gameStore = createGameStore();

export function useGame<T>(selector: (state: GameStoreState) => T): T {
  return useStore(gameStore, selector);
}

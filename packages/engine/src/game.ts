// De kern: een spel aanmaken en acties toepassen.
//
//   createGame(...)            -> beginstand
//   applyAction(state, action) -> { ok, state } of { ok: false, error }
//
// applyAction verandert de oude toestand nooit: het werkt op een kopie. Zo kan de web-app
// elke stand bewaren, en is een spel na te spelen uit "scenario + seed + lijst van acties".

import { defaultCatalog, SCENARIOS } from './data/index.ts';
import { hexKey, offsetToAxial } from './hex/hex.ts';
import { createRng } from './rng.ts';
import { planOrders } from './ai/opponent.ts';
import { terrainAt, unitTypeOf } from './rules/map.ts';
import { validateOrder } from './rules/orders.ts';
import { resolveTurn } from './rules/resolveTurn.ts';
import { getPlayerView } from './view.ts';
import type {
  ActionResult,
  Catalog,
  Controller,
  GameAction,
  GameState,
  Objective,
  Scenario,
  Side,
  Unit,
} from './types.ts';
import { POSTURES } from './data/index.ts';
import { updateLastSeen } from './rules/vision.ts';

export interface NewGameOptions {
  /** Scenario-object of id. Standaard het eerste scenario. */
  scenario?: Scenario | string;
  seed?: number;
  /** Eigen catalogus (eenheden en terrein). Standaard alles uit data/. */
  catalog?: Catalog;
  /** Wie speelt welke kant; overschrijft het scenario. */
  controllers?: Partial<Record<Side, Controller>>;
}

export function findScenario(id: string): Scenario {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario)
    throw new Error(`Onbekend scenario '${id}'. Staat het in data/scenarios/index.ts?`);
  return scenario;
}

export function createGame(options: NewGameOptions = {}): GameState {
  const scenario =
    typeof options.scenario === 'string'
      ? findScenario(options.scenario)
      : (options.scenario ?? SCENARIOS[0]!);
  const catalog = options.catalog ?? defaultCatalog();
  const seed = options.seed ?? 1;

  const rows = scenario.map.length;
  const cols = scenario.map[0]?.length ?? 0;
  const bySymbol = new Map(Object.values(catalog.terrains).map((t) => [t.symbol, t.id]));
  const terrain: string[] = [];
  scenario.map.forEach((line, row) => {
    if (line.length !== cols) {
      throw new Error(
        `Scenario '${scenario.id}': rij ${row} van de kaart heeft ${line.length} tekens, verwacht ${cols}.`,
      );
    }
    for (const ch of line) {
      const id = bySymbol.get(ch);
      if (!id)
        throw new Error(`Scenario '${scenario.id}': onbekend terreinteken '${ch}' in rij ${row}.`);
      terrain.push(id);
    }
  });
  const map = {
    cols,
    rows,
    terrain,
    placeNames: scenario.placeNames.map((p) => ({ name: p.name, hex: offsetToAxial(p) })),
  };

  const units: Record<string, Unit> = {};
  const occupied = new Set<string>();
  for (const u of scenario.units) {
    const hex = offsetToAxial(u);
    const type = unitTypeOf(catalog, u);
    const where = terrainAt(map, catalog, hex);
    if (!where)
      throw new Error(`Eenheid '${u.id}' staat buiten de kaart (kolom ${u.col}, rij ${u.row}).`);
    if (occupied.has(hexKey(hex)))
      throw new Error(`Eenheid '${u.id}' staat op dezelfde hex als een andere eenheid.`);
    if (units[u.id]) throw new Error(`Eenheid-id '${u.id}' komt twee keer voor.`);
    occupied.add(hexKey(hex));
    units[u.id] = {
      id: u.id,
      side: u.side,
      type: u.type,
      name: u.name,
      hex,
      strength: type.maxStrength,
    };
  }

  const objectives: Objective[] = scenario.objectives.map((o) => ({
    id: o.id,
    name: o.name,
    hex: offsetToAxial(o),
    value: o.value,
    controller: o.controller,
  }));

  const controllers: Record<Side, Controller> = {
    blue: options.controllers?.blue ?? scenario.controllers?.blue ?? { kind: 'human' },
    red: options.controllers?.red ??
      scenario.controllers?.red ?? { kind: 'ai', posture: 'balanced' },
  };

  const strengthOf = (side: Side) =>
    Object.values(units)
      .filter((u) => u.side === side)
      .reduce((sum, u) => sum + u.strength, 0);

  const state: GameState = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    briefing: scenario.briefing,
    seed,
    rng: createRng(seed),
    turn: 1,
    maxTurns: scenario.maxTurns,
    phase: 'planning',
    catalog,
    map,
    units,
    destroyed: {},
    objectives,
    orders: { blue: {}, red: {} },
    ready: { blue: false, red: false },
    controllers,
    lastSeen: { blue: {}, red: {} },
    startStrength: { blue: strengthOf('blue'), red: strengthOf('red') },
    victory: scenario.victory,
    history: [],
    outcome: null,
  };
  updateLastSeen(state);
  return state;
}

function fail(state: GameState, error: string): ActionResult {
  return { ok: false, error, state };
}

/** Pas één actie toe. De oude toestand blijft ongewijzigd. */
export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (state.phase === 'ended') return fail(state, 'Het spel is afgelopen.');
  const next = structuredClone(state);

  switch (action.type) {
    case 'setOrder': {
      if (next.ready[action.side])
        return fail(state, 'Deze kant is al klaar met plannen voor deze beurt.');
      const error = validateOrder(getPlayerView(next, action.side), action.unitId, action.order);
      if (error) return fail(state, error);
      next.orders[action.side][action.unitId] = action.order;
      return { ok: true, state: next };
    }
    case 'clearOrder': {
      if (next.ready[action.side])
        return fail(state, 'Deze kant is al klaar met plannen voor deze beurt.');
      delete next.orders[action.side][action.unitId];
      return { ok: true, state: next };
    }
    case 'setPosture': {
      if (!POSTURES.some((p) => p.id === action.posture)) {
        return fail(state, `Onbekende houding '${action.posture}'. Zie data/postures.ts.`);
      }
      const controller = next.controllers[action.side];
      if (controller.kind !== 'ai')
        return fail(state, 'Deze kant wordt niet door de computer gespeeld.');
      controller.posture = action.posture;
      return { ok: true, state: next };
    }
    case 'endTurn': {
      next.ready[action.side] = true;
      // Computerspelers plannen pas nu, met alleen hun eigen zicht (geen valsspelen).
      for (const side of ['blue', 'red'] as const) {
        const controller = next.controllers[side];
        if (controller.kind === 'ai' && !next.ready[side]) {
          next.orders[side] = planOrders(getPlayerView(next, side), controller.posture);
          next.ready[side] = true;
        }
      }
      if (next.ready.blue && next.ready.red) resolveTurn(next);
      return { ok: true, state: next };
    }
  }
}

/** Pas een reeks acties toe; stopt bij de eerste ongeldige actie met een fout. */
export function replay(state: GameState, actions: GameAction[]): GameState {
  let current = state;
  for (const [i, action] of actions.entries()) {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(`Actie ${i} (${action.type}) ongeldig: ${result.error}`);
    current = result.state;
  }
  return current;
}

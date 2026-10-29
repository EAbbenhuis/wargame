// HET SPELERSBEELD
//
// getPlayerView(state, side) geeft precies wat één kant mag weten: eigen eenheden, vijanden
// die nu zichtbaar zijn, en wat je je herinnert van vijanden die uit zicht zijn.
//
// Dit is de enige bron voor: de kaart in de web-app, de AI-tegenstander en de AI-staf.
// Daardoor kan geen van hen valsspelen: wat niet in het spelersbeeld zit, bestaat voor hen niet.

import { hexKey, type HexKey } from './hex/hex.ts';
import { aliveUnits } from './rules/map.ts';
import { visibleHexes } from './rules/vision.ts';
import type {
  Catalog,
  GameEvent,
  GameMap,
  GameState,
  LastSeen,
  Objective,
  Order,
  Outcome,
  Side,
  Unit,
} from './types.ts';

export interface KnownEnemy {
  id: string;
  type: string;
  name: string;
  hex: Unit['hex'];
  strength: number;
}

export interface PlayerView {
  side: Side;
  opponent: Side;
  scenarioName: string;
  briefing: string;
  turn: number;
  maxTurns: number;
  phase: GameState['phase'];
  catalog: Catalog;
  map: GameMap;
  objectives: Objective[];
  ownUnits: Unit[];
  enemies: KnownEnemy[];
  lastSeen: LastSeen[];
  visible: HexKey[];
  orders: Record<string, Order>;
  ready: boolean;
  /** Gebeurtenissen van de vorige beurt die deze kant kon waarnemen. */
  lastTurnEvents: GameEvent[];
  strength: { own: number; ownStart: number; enemyStart: number };
  outcome: Outcome | null;
  /** True als de fog of war uit staat (debugmenu). */
  revealed: boolean;
}

export function opponentOf(side: Side): Side {
  return side === 'blue' ? 'red' : 'blue';
}

export function getPlayerView(
  state: GameState,
  side: Side,
  options: { revealAll?: boolean } = {},
): PlayerView {
  const revealed = options.revealAll === true || state.phase === 'ended';
  const visible = visibleHexes(state, side);
  const all = aliveUnits(state.units);
  const own = all.filter((u) => u.side === side);
  const enemies = all
    .filter((u) => u.side !== side && (revealed || visible.has(hexKey(u.hex))))
    .map((u) => ({
      id: u.id,
      type: u.type,
      name: u.name,
      hex: { ...u.hex },
      strength: u.strength,
    }));
  const enemyIds = new Set(enemies.map((e) => e.id));
  const lastSeen = Object.values(state.lastSeen[side])
    .filter((s) => !enemyIds.has(s.unitId))
    .map((s) => ({ ...s }))
    .sort((a, b) => (a.unitId < b.unitId ? -1 : 1));

  const lastRecord = state.history.at(-1);
  const lastTurnEvents = lastRecord
    ? lastRecord.events.flatMap((e) => {
        const seen = observe(structuredClone(e), side, visible, revealed);
        return seen ? [seen] : [];
      })
    : [];

  // Kaart en catalogus worden gedeeld (die veranderen nooit); de rest is een eigen kopie.
  return {
    side,
    opponent: opponentOf(side),
    scenarioName: state.scenarioName,
    briefing: state.briefing,
    turn: state.turn,
    maxTurns: state.maxTurns,
    phase: state.phase,
    catalog: state.catalog,
    map: state.map,
    objectives: structuredClone(state.objectives),
    ownUnits: structuredClone(own),
    enemies,
    lastSeen,
    visible: revealed ? allHexKeys(state.map) : [...visible].sort(),
    orders: structuredClone(state.orders[side]),
    ready: state.ready[side],
    lastTurnEvents,
    strength: {
      own: own.reduce((sum, u) => sum + u.strength, 0),
      ownStart: state.startStrength[side],
      enemyStart: state.startStrength[opponentOf(side)],
    },
    outcome: structuredClone(state.outcome),
    revealed,
  };
}

function allHexKeys(map: GameMap): HexKey[] {
  const keys: HexKey[] = [];
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++)
      keys.push(hexKey({ q: col - (row - (row & 1)) / 2, r: row }));
  }
  return keys;
}

/**
 * Wat ziet deze kant van een gebeurtenis? Eigen eenheden: alles. Vijandelijke acties alleen
 * voor zover ze plaatsvonden op hexen die je nu ziet. `null` = niets gezien.
 */
function observe(
  event: GameEvent,
  side: Side,
  visible: Set<HexKey>,
  revealed: boolean,
): GameEvent | null {
  if (revealed) return event;
  const seen = (hex: Unit['hex']) => visible.has(hexKey(hex));
  switch (event.type) {
    case 'combat':
    case 'captured':
      // Bij een gevecht is altijd een eigen eenheid betrokken; wie een doel bezit is bekend.
      return event;
    case 'fire':
      return event.side === side || seen(event.target) ? event : null;
    case 'move': {
      if (event.side === side) return event;
      const path = event.path.filter(seen);
      return path.length > 0 ? { ...event, path } : null;
    }
    case 'halted':
    case 'destroyed':
      return event.side === side || seen(event.at) ? event : null;
    case 'retreat':
      return event.side === side || seen(event.from) ? event : null;
    case 'attackCancelled':
    case 'resupplied':
      return event.side === side ? event : null;
  }
}

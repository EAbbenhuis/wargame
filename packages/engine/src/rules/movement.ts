// BEWEGING
//
// Elke eenheid heeft bewegingspunten (eenheidstype.movement). Elke hex die je binnengaat
// kost punten volgens het terrein en de bewegingsklasse (zie data/terrains.ts).
// Bij het plannen geldt bovendien:
//  - je kunt niet door een hex waar een (bekende) vijand staat;
//  - wie naast een bekende vijand komt, stopt daar (contact, "zone of control");
//  - je mag door eigen eenheden heen, maar niet op dezelfde hex eindigen.
// Bij het uitvoeren van de beurt kan er meer misgaan, want de vijand beweegt tegelijk
// (zie resolveTurn.ts).

import { hexDistance, hexKey, hexNeighbors, parseHexKey, type HexKey } from '../hex/hex.ts';
import type { Catalog, GameMap, Hex, UnitType } from '../types.ts';
import type { PlayerView } from '../view.ts';
import { terrainAt, unitTypeOf } from './map.ts';

/** Kosten om deze hex binnen te gaan, of null als dat niet kan. */
export function moveCost(map: GameMap, catalog: Catalog, type: UnitType, hex: Hex): number | null {
  const terrain = terrainAt(map, catalog, hex);
  if (!terrain) return null;
  const cost = terrain.moveCost[type.movementClass];
  return cost === undefined ? terrain.moveCost.default : cost;
}

export interface ReachInfo {
  hex: Hex;
  cost: number;
  previous: HexKey | null;
}

/** Ligt deze hex naast een vijand die deze kant kent? */
export function isNextToKnownEnemy(view: PlayerView, hex: Hex): boolean {
  return view.enemies.some((e) => hexDistance(e.hex, hex) === 1);
}

/**
 * Alle hexen die deze eenheid deze beurt kan bereiken, met kosten en route.
 * Bevat alleen hexen waar de eenheid ook mag eindigen.
 */
export function reachableHexes(view: PlayerView, unitId: string): Map<HexKey, ReachInfo> {
  const { best, endable } = explore(view, unitId);
  const result = new Map<HexKey, ReachInfo>();
  for (const [key, info] of best) if (endable(key)) result.set(key, info);
  return result;
}

/** Zoekt alle routes; `endable` zegt of je op een hex mag eindigen. */
function explore(
  view: PlayerView,
  unitId: string,
): { best: Map<HexKey, ReachInfo>; endable: (key: HexKey) => boolean } {
  const unit = view.ownUnits.find((u) => u.id === unitId);
  const best = new Map<HexKey, ReachInfo>();
  if (!unit) return { best, endable: () => false };
  const type = unitTypeOf(view.catalog, unit);
  const enemyHexes = new Set(view.enemies.map((e) => hexKey(e.hex)));
  const friendlyHexes = new Set(
    view.ownUnits.filter((u) => u.id !== unitId).map((u) => hexKey(u.hex)),
  );

  // Hexen naast een bekende vijand: daar stopt de beweging (contact).
  const contactHexes = new Set(view.enemies.flatMap((e) => hexNeighbors(e.hex).map(hexKey)));

  const startKey = hexKey(unit.hex);
  best.set(startKey, { hex: unit.hex, cost: 0, previous: null });
  // Dijkstra met een emmer per kostenniveau (kosten zijn kleine gehele getallen).
  // Binnen een emmer gaan we op volgorde van sleutel: zo is de uitkomst altijd hetzelfde.
  const buckets: HexKey[][] = Array.from({ length: type.movement + 1 }, () => []);
  buckets[0]!.push(startKey);
  const done = new Set<HexKey>();
  for (let level = 0; level <= type.movement; level++) {
    const bucket = buckets[level]!.sort();
    for (const key of bucket) {
      const current = best.get(key)!;
      if (done.has(key) || current.cost !== level) continue;
      done.add(key);
      if (key !== startKey && contactHexes.has(key)) continue;
      for (const next of hexNeighbors(current.hex)) {
        const nextKey = hexKey(next);
        if (done.has(nextKey) || enemyHexes.has(nextKey)) continue;
        const step = moveCost(view.map, view.catalog, type, next);
        if (step === null) continue;
        const cost = current.cost + step;
        if (cost > type.movement) continue;
        const known = best.get(nextKey);
        if (!known || cost < known.cost) {
          best.set(nextKey, { hex: next, cost, previous: key });
          buckets[cost]!.push(nextKey);
        }
      }
    }
  }
  return { best, endable: (key) => key !== startKey && best.has(key) && !friendlyHexes.has(key) };
}

/** Alle bereikbare hexen met het goedkoopste pad erheen, in één zoektocht (snel, voor de AI). */
export function reachablePaths(
  view: PlayerView,
  unitId: string,
): Map<HexKey, ReachInfo & { path: Hex[] }> {
  const { best, endable } = explore(view, unitId);
  const result = new Map<HexKey, ReachInfo & { path: Hex[] }>();
  for (const [key, info] of best) {
    if (!endable(key)) continue;
    result.set(key, { ...info, path: buildPath(best, key) });
  }
  return result;
}

function buildPath(best: Map<HexKey, ReachInfo>, target: HexKey): Hex[] {
  const path: Hex[] = [];
  let key: HexKey | null = target;
  while (key) {
    const info: ReachInfo = best.get(key)!;
    if (info.previous === null) break; // starthex hoort niet in het pad
    path.unshift(parseHexKey(key));
    key = info.previous;
  }
  return path;
}

/** Goedkoopste pad (zonder starthex) naar een bereikbare hex, of null. */
export function findPath(view: PlayerView, unitId: string, to: Hex): Hex[] | null {
  const { best, endable } = explore(view, unitId);
  const key = hexKey(to);
  return endable(key) ? buildPath(best, key) : null;
}

// ZICHT EN FOG OF WAR
//
// Een kant ziet een hex als minstens één eigen eenheid hem ziet:
//  - binnen zichtafstand (eenheidstype.vision + terrein.visionBonus van de hex waar de eenheid staat);
//  - met vrije zichtlijn: hexen tussen waarnemer en doel met `blocksSight` blokkeren het zicht,
//    behalve als de waarnemer hoger staat (terrein.elevation) dan het blokkerende terrein.
// Aangrenzende hexen zie je altijd.

import {
  hexDistance,
  hexKey,
  hexLine,
  hexesWithinRange,
  isInBounds,
  type HexKey,
} from '../hex/hex.ts';
import type { GameState, Hex, Side, Unit } from '../types.ts';
import { aliveUnits, terrainAt, unitTypeOf } from './map.ts';

type VisionState = Pick<GameState, 'map' | 'catalog' | 'units'>;

export function canSee(state: VisionState, observer: Unit, target: Hex): boolean {
  const type = unitTypeOf(state.catalog, observer);
  const here = terrainAt(state.map, state.catalog, observer.hex);
  const range = type.vision + (here?.visionBonus ?? 0);
  const distance = hexDistance(observer.hex, target);
  if (distance > range) return false;
  if (distance <= 1) return true;
  const elevation = here?.elevation ?? 0;
  // Een lijn precies langs een hexrand kan twee kanten op; het zicht is vrij als één van
  // beide vrij is. Zo geldt: als A B ziet, ziet B ook A.
  const clear = (nudge: 1 | -1) =>
    hexLine(observer.hex, target, nudge)
      .slice(1, -1)
      .every((hex) => {
        const terrain = terrainAt(state.map, state.catalog, hex);
        return !(terrain?.blocksSight && terrain.elevation >= elevation);
      });
  return clear(1) || clear(-1);
}

/** Alle hexen die een kant nu kan zien. */
export function visibleHexes(state: VisionState, side: Side): Set<HexKey> {
  const visible = new Set<HexKey>();
  for (const observer of aliveUnits(state.units)) {
    if (observer.side !== side) continue;
    const type = unitTypeOf(state.catalog, observer);
    const range =
      type.vision + (terrainAt(state.map, state.catalog, observer.hex)?.visionBonus ?? 0);
    for (const hex of hexesWithinRange(observer.hex, range)) {
      const key = hexKey(hex);
      if (visible.has(key) || !isInBounds(hex, state.map)) continue;
      if (canSee(state, observer, hex)) visible.add(key);
    }
  }
  return visible;
}

/** Werk het geheugen bij: vijanden die je nu ziet, onthoud je met positie en beurt. */
export function updateLastSeen(state: GameState): void {
  for (const side of ['blue', 'red'] as const) {
    const visible = visibleHexes(state, side);
    const memory = state.lastSeen[side];
    for (const unit of aliveUnits(state.units)) {
      if (unit.side === side || !visible.has(hexKey(unit.hex))) continue;
      memory[unit.id] = {
        unitId: unit.id,
        type: unit.type,
        hex: unit.hex,
        strength: unit.strength,
        turn: state.turn,
      };
    }
    // Vergeet eenheden die vernietigd zijn, of waarvan je ziet dat ze niet meer op de oude plek staan.
    for (const [id, seen] of Object.entries(memory)) {
      const actual = state.units[id];
      if (!actual) delete memory[id];
      else if (visible.has(hexKey(seen.hex)) && hexKey(actual.hex) !== hexKey(seen.hex))
        delete memory[id];
    }
  }
}

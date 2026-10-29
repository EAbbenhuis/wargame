// Opzoeken op de kaart: terrein, eenheden, doelen. Geen spelregels, alleen hulpfuncties.
import { axialToOffset, hexEquals, isInBounds } from '../hex/hex.ts';
import type { Catalog, GameMap, Hex, TerrainType, Unit, UnitType } from '../types.ts';

export function terrainAt(map: GameMap, catalog: Catalog, hex: Hex): TerrainType | null {
  if (!isInBounds(hex, map)) return null;
  const { col, row } = axialToOffset(hex);
  const id = map.terrain[row * map.cols + col];
  return id === undefined ? null : (catalog.terrains[id] ?? null);
}

export function unitTypeOf(catalog: Catalog, unit: { type: string }): UnitType {
  const type = catalog.unitTypes[unit.type];
  if (!type)
    throw new Error(`Onbekend eenheidstype '${unit.type}'. Staat het in data/unitTypes.ts?`);
  return type;
}

export function unitAt<T extends { hex: Hex }>(units: Iterable<T>, hex: Hex): T | undefined {
  for (const unit of units) if (hexEquals(unit.hex, hex)) return unit;
  return undefined;
}

export function aliveUnits(units: Record<string, Unit>): Unit[] {
  // Vaste volgorde (op id) maakt alles wat erop volgt deterministisch.
  return Object.values(units).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

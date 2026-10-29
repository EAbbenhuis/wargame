// Ingang van alle spel-data. De rest van de engine haalt data alleen hier vandaan.
import type { Catalog } from '../types.ts';
import { TERRAINS } from './terrains.ts';
import { UNIT_TYPES } from './unitTypes.ts';

export {
  COMBAT_TABLE,
  FIRE_TABLE,
  DEFEND_ORDER_MULTIPLIER,
  NO_RETREAT_EXTRA_LOSS,
  RESUPPLY_AMOUNT,
} from './combatTables.ts';
export type { CombatColumn, CombatResult } from './combatTables.ts';
export { POSTURES } from './postures.ts';
export type { Posture } from './postures.ts';
export { SCENARIOS } from './scenarios/index.ts';
export { TERRAINS, UNIT_TYPES };

/** Standaardcatalogus: alle eenheidstypes en terreinsoorten uit deze map. */
export function defaultCatalog(): Catalog {
  return {
    unitTypes: Object.fromEntries(UNIT_TYPES.map((t) => [t.id, t])),
    terrains: Object.fromEntries(TERRAINS.map((t) => [t.id, t])),
  };
}

// GEVECHTSREGELS (modifiers)
//
// Uitbreidingspunt "nieuwe regel in het gevecht": voeg een object toe aan COMBAT_MODIFIERS.
// Elke regel kijkt naar een gevecht en kan:
//   attackMultiplier   aanval x dit getal
//   defenseMultiplier  verdediging x dit getal
//   columnShift        kolommen opschuiven in de gevechtstabel (+1 = beter voor de aanvaller)
//   note               korte uitleg die de speler in het gevechtsverslag ziet
// Geef null terug als de regel niet van toepassing is.
//
// Voorbeeld van een nieuwe regel (regen maakt aanvallen lastiger):
//   { id: 'regen', apply: (ctx) => ({ attackMultiplier: 0.8, note: 'regen: aanval x0,8' }) },

import { hexDistance } from '../hex/hex.ts';
import { DEFEND_ORDER_MULTIPLIER } from '../data/index.ts';
import type { CombatContext } from './combat.ts';
import { terrainAt } from './map.ts';

export interface ModifierEffect {
  attackMultiplier?: number;
  defenseMultiplier?: number;
  columnShift?: number;
  note?: string;
}

export interface CombatModifier {
  id: string;
  apply: (ctx: CombatContext) => ModifierEffect | null;
}

const fmt = (n: number) => String(n).replace('.', ',');

export const COMBAT_MODIFIERS: CombatModifier[] = [
  {
    // Terrein van de verdediger (zie data/terrains.ts: defenseMultiplier).
    id: 'terrein',
    apply: (ctx) => {
      const terrain = terrainAt(ctx.map, ctx.catalog, ctx.defender.hex);
      if (!terrain || terrain.defenseMultiplier === 1) return null;
      return {
        defenseMultiplier: terrain.defenseMultiplier,
        note: `${terrain.name.toLowerCase()}: verdediging x${fmt(terrain.defenseMultiplier)}`,
      };
    },
  },
  {
    // Een eenheid met de order 'verdedigen' heeft zich ingegraven.
    id: 'ingegraven',
    apply: (ctx) =>
      ctx.defenderDefending
        ? {
            defenseMultiplier: DEFEND_ORDER_MULTIPLIER,
            note: `ingegraven: verdediging x${fmt(DEFEND_ORDER_MULTIPLIER)}`,
          }
        : null,
  },
  {
    // Aanval uit meerdere richtingen: andere eigen eenheden naast de verdediger.
    id: 'flank',
    apply: (ctx) => {
      const count = (ctx.supporters ?? []).filter(
        (s) => hexDistance(s.hex, ctx.defender.hex) === 1,
      ).length;
      return count > 0
        ? { columnShift: 1, note: 'aanval uit meerdere richtingen: +1 kolom' }
        : null;
    },
  },
  {
    // Aanvallen vanuit lastig terrein (bijvoorbeeld een rivier): zie attackFromShift in data/terrains.ts.
    id: 'aanvalsterrein',
    apply: (ctx) => {
      const terrain = terrainAt(ctx.map, ctx.catalog, ctx.attacker.hex);
      const shift = terrain?.attackFromShift ?? 0;
      if (shift === 0) return null;
      return {
        columnShift: shift,
        note: `aanval vanuit ${terrain!.name.toLowerCase()}: ${shift > 0 ? '+' : ''}${shift} kolom`,
      };
    },
  },
];

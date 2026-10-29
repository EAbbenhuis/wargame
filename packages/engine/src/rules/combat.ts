// GEVECHT
//
// 1. Aanval    = aanvalswaarde van het eenheidstype x (sterkte / volle sterkte)
// 2. Verdediging = verdedigingswaarde x (sterkte / volle sterkte)
// 3. Gevechtsregels (combatModifiers.ts) passen aanval, verdediging en kolom aan.
// 4. Verhouding aanval/verdediging kiest een kolom in de gevechtstabel (data/combatTables.ts).
// 5. Een worp (1-6) uit de geseede generator kiest de uitkomst.
//
// Deze functies werken met het spelersbeeld én met de volledige toestand, zodat de web-app
// vooraf de kansen kan tonen met precies dezelfde berekening als het echte gevecht.

import { COMBAT_TABLE, type CombatResult } from '../data/index.ts';
import type { Catalog, GameMap, Hex } from '../types.ts';
import { COMBAT_MODIFIERS } from './combatModifiers.ts';
import { unitTypeOf } from './map.ts';

export interface Combatant {
  type: string;
  hex: Hex;
  strength: number;
}

export interface CombatContext {
  map: GameMap;
  catalog: Catalog;
  attacker: Combatant;
  defender: Combatant;
  /** Heeft de verdediger de order 'verdedigen'? */
  defenderDefending?: boolean;
  /** Andere eenheden van de aanvaller die naast de verdediger staan. */
  supporters?: Combatant[];
}

export interface CombatOdds {
  attack: number;
  defense: number;
  ratio: number;
  columnIndex: number;
  column: string;
  notes: string[];
}

const round = (n: number) => Math.round(n * 100) / 100;

export function computeOdds(ctx: CombatContext): CombatOdds {
  const attackerType = unitTypeOf(ctx.catalog, ctx.attacker);
  const defenderType = unitTypeOf(ctx.catalog, ctx.defender);
  let attack = attackerType.attack * (ctx.attacker.strength / attackerType.maxStrength);
  let defense = defenderType.defense * (ctx.defender.strength / defenderType.maxStrength);
  let shift = 0;
  const notes: string[] = [];
  for (const modifier of COMBAT_MODIFIERS) {
    const effect = modifier.apply(ctx);
    if (!effect) continue;
    attack *= effect.attackMultiplier ?? 1;
    defense *= effect.defenseMultiplier ?? 1;
    shift += effect.columnShift ?? 0;
    if (effect.note) notes.push(effect.note);
  }
  attack = round(attack);
  defense = round(Math.max(defense, 0.1));
  const ratio = round(attack / defense);
  let base = 0;
  COMBAT_TABLE.forEach((column, i) => {
    if (ratio >= column.minRatio) base = i;
  });
  const columnIndex = Math.min(COMBAT_TABLE.length - 1, Math.max(0, base + shift));
  return { attack, defense, ratio, columnIndex, column: COMBAT_TABLE[columnIndex]!.label, notes };
}

export function combatResult(odds: CombatOdds, roll: number): CombatResult {
  const column = COMBAT_TABLE[odds.columnIndex]!;
  return column.results[Math.min(6, Math.max(1, roll)) - 1]!;
}

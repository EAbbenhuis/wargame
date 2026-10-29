// GEVECHTSTABELLEN
//
// Een klassieke "combat results table" (CRT), zoals in bordspel-wargames.
// 1. De engine berekent de verhouding aanval : verdediging (zie rules/combat.ts).
// 2. Die verhouding kiest een kolom. Gevechtsregels kunnen de kolom verschuiven (rules/combatModifiers.ts).
// 3. Een worp met een zeszijdige dobbelsteen (1-6) kiest de rij.
// 4. De cel zegt hoeveel sterkte aanvaller en verdediger verliezen, en of de verdediger terugtrekt.
//
// Pas de getallen hier aan om gevechten bloediger of voorzichtiger te maken.

export interface CombatResult {
  /** Verlies van de aanvaller in sterktepunten. */
  attacker: number;
  /** Verlies van de verdediger in sterktepunten. */
  defender: number;
  /** Moet de verdediger een hex terugtrekken? */
  retreat: boolean;
}

export interface CombatColumn {
  /** Label zoals spelers het zien, bijvoorbeeld '2:1'. */
  label: string;
  /** Vanaf deze verhouding aanval/verdediging geldt deze kolom. */
  minRatio: number;
  /** Uitkomst per worp: index 0 = worp 1, index 5 = worp 6. */
  results: [CombatResult, CombatResult, CombatResult, CombatResult, CombatResult, CombatResult];
}

const r = (attacker: number, defender: number, retreat = false): CombatResult => ({
  attacker,
  defender,
  retreat,
});

/** Kolommen van laag naar hoog. */
export const COMBAT_TABLE: CombatColumn[] = [
  { label: '1:2', minRatio: 0, results: [r(3, 0), r(3, 1), r(2, 1), r(2, 1), r(2, 2), r(1, 2)] },
  {
    label: '1:1',
    minRatio: 0.8,
    results: [r(2, 1), r(2, 1), r(2, 2), r(1, 2), r(1, 3), r(1, 3, true)],
  },
  {
    label: '3:2',
    minRatio: 1.4,
    results: [r(2, 1), r(1, 2), r(1, 2), r(1, 3), r(1, 3, true), r(0, 4, true)],
  },
  {
    label: '2:1',
    minRatio: 1.9,
    results: [r(1, 2), r(1, 2), r(1, 3), r(1, 3, true), r(0, 4, true), r(0, 4, true)],
  },
  {
    label: '3:1',
    minRatio: 2.8,
    results: [r(1, 2), r(1, 3), r(0, 3, true), r(0, 4, true), r(0, 5, true), r(0, 5, true)],
  },
];

/**
 * Schade door indirect vuur (artillerie) per worp, vóór dekking en vuurkracht.
 * Schade = tabel[worp] + vuurkracht van de artillerie - dekking van het terrein (minimaal 0).
 */
export const FIRE_TABLE: [number, number, number, number, number, number] = [-1, 0, 0, 1, 1, 2];

/** Verdediging wordt met dit getal vermenigvuldigd als een eenheid de order 'verdedigen' heeft. */
export const DEFEND_ORDER_MULTIPLIER = 1.5;

/** Extra verlies als een eenheid moet terugtrekken maar nergens heen kan. */
export const NO_RETREAT_EXTRA_LOSS = 2;

/** Herstel per beurt voor eenheden binnen bereik van logistiek. */
export const RESUPPLY_AMOUNT = 1;

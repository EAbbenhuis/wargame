// Gebeurtenissen in gewone Nederlandse zinnen, voor het beurtverslag, de staf en het
// after-action report. Geen spelregels: alleen tekst.

import { axialToOffset } from '../hex/hex.ts';
import type { GameEvent, GameState, Hex, Side } from '../types.ts';
import type { PlayerView } from '../view.ts';

export type NameLookup = (unitId: string) => string;

export const SIDE_NAMES: Record<Side, string> = { blue: 'Blauw', red: 'Rood' };

export function describeHex(hex: Hex): string {
  const { col, row } = axialToOffset(hex);
  return `(${col},${row})`;
}

/** Namen die deze kant kent: eigen eenheden en vijanden die hij ziet of zag. */
export function namesFromView(view: PlayerView): NameLookup {
  return (id) => view.unitNames[id] ?? 'een vijandelijke eenheid';
}

/** Alle namen (na afloop van het spel, of voor het debugmenu). */
export function namesFromState(state: GameState): NameLookup {
  return (id) => state.units[id]?.name ?? state.destroyed[id]?.name ?? id;
}

const fmt = (n: number) => String(n).replace('.', ',');

export function describeEvent(
  event: GameEvent,
  name: NameLookup,
  objectiveName: (id: string) => string = (id) => id,
): string {
  switch (event.type) {
    case 'fire': {
      const shooter = event.unitId ? name(event.unitId) : 'Onbekende vijandelijke artillerie';
      return event.targetUnitId
        ? `${shooter} vuurt op ${name(event.targetUnitId)} ${describeHex(event.target)}: ${event.damage} schade (worp ${event.roll}).`
        : `${shooter} vuurt op ${describeHex(event.target)}, maar daar staat niemand meer.`;
    }
    case 'move':
      return `${name(event.unitId)} verplaatst naar ${describeHex(event.path.at(-1)!)}.`;
    case 'halted':
      return event.reason === 'contact'
        ? `${name(event.unitId)} stuit op de vijand en stopt bij ${describeHex(event.at)}.`
        : `${name(event.unitId)} kan niet verder en stopt bij ${describeHex(event.at)}.`;
    case 'combat': {
      const result = [
        event.defenderLoss > 0
          ? `${name(event.defenderId)} verliest ${event.defenderLoss}`
          : `${name(event.defenderId)} houdt stand`,
        event.attackerLoss > 0 ? `${name(event.attackerId)} verliest ${event.attackerLoss}` : null,
        event.retreat ? `${name(event.defenderId)} moet terugtrekken` : null,
      ]
        .filter(Boolean)
        .join(', ');
      const notes = event.notes.length > 0 ? ` (${event.notes.join('; ')})` : '';
      return `${name(event.attackerId)} valt ${name(event.defenderId)} aan: ${fmt(event.attack)} tegen ${fmt(event.defense)}${notes}, kolom ${event.column}, worp ${event.roll}. ${result}.`;
    }
    case 'attackCancelled':
      return event.reason === 'gone'
        ? `Aanval van ${name(event.unitId)} gaat niet door: het doelwit bestaat niet meer.`
        : `Aanval van ${name(event.unitId)} gaat niet door: ${name(event.targetId)} staat niet meer ernaast.`;
    case 'retreat':
      if (event.toHidden) return `${name(event.unitId)} trekt terug, buiten ons zicht.`;
      return event.to
        ? `${name(event.unitId)} trekt terug naar ${describeHex(event.to)}.`
        : `${name(event.unitId)} kan nergens heen en lijdt extra verliezen.`;
    case 'destroyed':
      return `${name(event.unitId)} is vernietigd bij ${describeHex(event.at)}.`;
    case 'resupplied':
      return `${name(event.unitId)} wordt bevoorraad (+${event.amount}).`;
    case 'captured':
      return `${SIDE_NAMES[event.side]} neemt ${objectiveName(event.objectiveId)} in${event.from ? ` (was van ${SIDE_NAMES[event.from]})` : ''}.`;
  }
}

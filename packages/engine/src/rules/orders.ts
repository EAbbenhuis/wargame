// ORDERS CONTROLEREN
//
// validateOrder controleert of een order mag, met alleen de kennis van de eigen kant
// (het spelersbeeld). Elke order gaat hierdoor: van de speler, de AI-tegenstander en de AI-staf.
// Een foutmelding is gewone taal, want spelers krijgen hem te zien.
//
// intentToOrder maakt van een voorstel in gewone termen ("ga naar die hex", "val die eenheid aan")
// een order met een pad. De AI-staf gebruikt dit, zodat een taalmodel geen paden hoeft te tekenen.

import { hexDistance, hexKey, hexNeighbors } from '../hex/hex.ts';
import type { Hex, Order, OrderIntent } from '../types.ts';
import type { PlayerView } from '../view.ts';
import { terrainAt, unitTypeOf } from './map.ts';
import { findPath, isNextToKnownEnemy, moveCost, reachableHexes } from './movement.ts';

function describeHex(hex: Hex): string {
  const col = hex.q + (hex.r - (hex.r & 1)) / 2;
  return `kolom ${col}, rij ${hex.r}`;
}

/** null = de order mag. Anders een uitleg waarom niet. */
export function validateOrder(view: PlayerView, unitId: string, order: Order): string | null {
  const unit = view.ownUnits.find((u) => u.id === unitId);
  if (!unit) return `Eenheid '${unitId}' bestaat niet of is niet van u.`;
  const type = unitTypeOf(view.catalog, unit);

  if (order.kind === 'defend') return null;

  if (order.kind === 'fire') {
    if (type.fireRange <= 0) return `${unit.name} heeft geen indirect vuur.`;
    if (!terrainAt(view.map, view.catalog, order.target)) return 'Dat doel ligt buiten de kaart.';
    const distance = hexDistance(unit.hex, order.target);
    if (distance < 1 || distance > type.fireRange) {
      return `Doel buiten bereik: ${distance} hexen, ${unit.name} vuurt tot ${type.fireRange} hexen.`;
    }
    if (!view.visible.includes(hexKey(order.target))) {
      return `Wij kunnen ${describeHex(order.target)} niet zien. Artillerie vuurt alleen op hexen die een eigen eenheid ziet.`;
    }
    return null;
  }

  // move en attack: eerst het pad controleren.
  const pathError = validatePath(view, unitId, order.path);
  if (pathError) return pathError;

  if (order.kind === 'attack') {
    if (type.attack <= 0) return `${unit.name} kan niet aanvallen.`;
    const target = view.enemies.find((e) => e.id === order.targetId);
    if (!target)
      return 'Dat doelwit is niet zichtbaar. U kunt alleen eenheden aanvallen die u ziet.';
    const end = order.path.at(-1) ?? unit.hex;
    if (hexDistance(end, target.hex) !== 1) {
      return `Na de beweging staat ${unit.name} niet naast het doelwit. Kies een pad dat naast de vijand eindigt.`;
    }
  }
  return null;
}

function validatePath(view: PlayerView, unitId: string, path: Hex[]): string | null {
  const unit = view.ownUnits.find((u) => u.id === unitId)!;
  const type = unitTypeOf(view.catalog, unit);
  let previous = unit.hex;
  let cost = 0;
  for (const [i, hex] of path.entries()) {
    if (hexDistance(previous, hex) !== 1)
      return 'Het pad moet stap voor stap aansluiten (alleen naar een buurhex).';
    const step = moveCost(view.map, view.catalog, type, hex);
    if (step === null) {
      const terrain = terrainAt(view.map, view.catalog, hex);
      return terrain
        ? `${unit.name} kan niet door ${terrain.name.toLowerCase()} (${describeHex(hex)}).`
        : 'Het pad gaat buiten de kaart.';
    }
    if (view.enemies.some((e) => hexKey(e.hex) === hexKey(hex)))
      return 'Het pad gaat door een vijandelijke eenheid.';
    if (i < path.length - 1 && isNextToKnownEnemy(view, hex)) {
      return `Het pad komt naast een vijand (${describeHex(hex)}): daar stopt de beweging.`;
    }
    cost += step;
    previous = hex;
  }
  if (cost > type.movement) {
    return `Buiten bereik: het pad kost ${cost} bewegingspunten, ${unit.name} heeft er ${type.movement}.`;
  }
  const end = path.at(-1);
  if (end && view.ownUnits.some((u) => u.id !== unitId && hexKey(u.hex) === hexKey(end))) {
    return 'Op die hex staat al een eigen eenheid.';
  }
  return null;
}

export type IntentResult = { ok: true; order: Order } | { ok: false; error: string };

/** Zet een voorstel om in een order, of leg uit waarom het niet kan. */
export function intentToOrder(view: PlayerView, intent: OrderIntent): IntentResult {
  const unit = view.ownUnits.find((u) => u.id === intent.unitId);
  if (!unit)
    return { ok: false, error: `Eenheid '${intent.unitId}' bestaat niet of is niet van u.` };

  const checked = (order: Order): IntentResult => {
    const error = validateOrder(view, unit.id, order);
    return error ? { ok: false, error } : { ok: true, order };
  };

  switch (intent.kind) {
    case 'defend':
      return checked({ kind: 'defend' });
    case 'fire':
      return checked({ kind: 'fire', target: intent.target });
    case 'move': {
      if (hexKey(intent.to) === hexKey(unit.hex)) return checked({ kind: 'defend' });
      const terrain = terrainAt(view.map, view.catalog, intent.to);
      if (!terrain) return { ok: false, error: 'Die bestemming ligt buiten de kaart.' };
      const path = findPath(view, unit.id, intent.to);
      if (!path) {
        const type = unitTypeOf(view.catalog, unit);
        return {
          ok: false,
          error: `Buiten bereik: ${unit.name} (${type.movement} bewegingspunten) kan ${describeHex(intent.to)} deze beurt niet bereiken.`,
        };
      }
      return checked({ kind: 'move', path });
    }
    case 'attack': {
      const target = view.enemies.find((e) => e.id === intent.targetId);
      if (!target) return { ok: false, error: 'Dat doelwit is niet zichtbaar.' };
      if (hexDistance(unit.hex, target.hex) === 1) {
        return checked({ kind: 'attack', path: [], targetId: target.id });
      }
      const reach = reachableHexes(view, unit.id);
      const options = hexNeighbors(target.hex)
        .map((hex) => reach.get(hexKey(hex)))
        .filter((info) => info !== undefined)
        .sort((a, b) => a.cost - b.cost || (hexKey(a.hex) < hexKey(b.hex) ? -1 : 1));
      const best = options[0];
      if (!best)
        return {
          ok: false,
          error: `Buiten bereik: ${unit.name} kan deze beurt niet naast het doelwit komen.`,
        };
      const path = findPath(view, unit.id, best.hex)!;
      return checked({ kind: 'attack', path, targetId: target.id });
    }
  }
}

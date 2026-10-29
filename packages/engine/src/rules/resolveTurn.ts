// EEN BEURT UITVOEREN (beide kanten tegelijk)
//
// Als beide kanten klaar zijn met plannen, voert de engine alle orders tegelijk uit, in vaste fasen:
//   1. Vuur:      artillerie vuurt op de hex die het koos. Wie daar dan staat, krijgt schade.
//   2. Beweging:  alle eenheden bewegen stap voor stap tegelijk (zie moveAll hieronder).
//   3. Gevecht:   aanvallen worden uitgevoerd als het doelwit nu naast de aanvaller staat.
//   4. Herstel:   eenheden naast logistiek herstellen.
//   5. Doelen:    wie op een doel staat, neemt het in.
//   6. Einde:     volgende beurt, of de uitslag na de laatste beurt.
//
// Volgorde binnen een fase is altijd op eenheid-id, zodat de uitkomst bij dezelfde seed gelijk is.
// Alle toeval komt uit state.rng (de geseede generator).

import { FIRE_TABLE, NO_RETREAT_EXTRA_LOSS, RESUPPLY_AMOUNT } from '../data/index.ts';
import { hexDistance, hexKey, hexNeighbors } from '../hex/hex.ts';
import { rollD6 } from '../rng.ts';
import type { GameEvent, GameState, Hex, Order, Side, Unit } from '../types.ts';
import { combatResult, computeOdds } from './combat.ts';
import { aliveUnits, terrainAt, unitAt, unitTypeOf } from './map.ts';
import { moveCost } from './movement.ts';
import { computeOutcome } from './victory.ts';
import { updateLastSeen } from './vision.ts';

const SIDES: Side[] = ['blue', 'red'];

function orderOf(state: GameState, unit: Unit): Order | undefined {
  return state.orders[unit.side][unit.id];
}

/** Voert de beurt uit. Verandert `state` (applyAction werkt al op een kopie). */
export function resolveTurn(state: GameState): void {
  const events: GameEvent[] = [];
  firePhase(state, events);
  moveAll(state, events);
  combatPhase(state, events);
  resupplyPhase(state, events);
  objectivePhase(state, events);

  state.history.push({
    turn: state.turn,
    events,
    strength: {
      blue: aliveUnits(state.units)
        .filter((u) => u.side === 'blue')
        .reduce((s, u) => s + u.strength, 0),
      red: aliveUnits(state.units)
        .filter((u) => u.side === 'red')
        .reduce((s, u) => s + u.strength, 0),
    },
    objectives: Object.fromEntries(state.objectives.map((o) => [o.id, o.controller])),
  });

  state.orders = { blue: {}, red: {} };
  state.ready = { blue: false, red: false };
  const wipedOut = SIDES.some((side) => !aliveUnits(state.units).some((u) => u.side === side));
  if (state.turn >= state.maxTurns || wipedOut) {
    state.phase = 'ended';
    state.outcome = computeOutcome(state);
  } else {
    state.turn += 1;
  }
  updateLastSeen(state);
}

// ---------------------------------------------------------------------------
// 1. Vuur
// ---------------------------------------------------------------------------

function firePhase(state: GameState, events: GameEvent[]): void {
  const damage = new Map<string, number>();
  for (const unit of aliveUnits(state.units)) {
    const order = orderOf(state, unit);
    if (order?.kind !== 'fire') continue;
    const type = unitTypeOf(state.catalog, unit);
    const target = unitAt(aliveUnits(state.units), order.target);
    const roll = rollD6(state.rng);
    let amount = 0;
    if (target && target.side !== unit.side) {
      const cover = terrainAt(state.map, state.catalog, target.hex)?.cover ?? 0;
      const weakened = unit.strength < type.maxStrength / 2 ? 1 : 0;
      amount = Math.max(0, FIRE_TABLE[roll - 1]! + type.firepower - cover - weakened);
      damage.set(target.id, (damage.get(target.id) ?? 0) + amount);
    }
    events.push({
      type: 'fire',
      unitId: unit.id,
      side: unit.side,
      target: order.target,
      targetUnitId: target && target.side !== unit.side ? target.id : null,
      roll,
      damage: amount,
    });
  }
  // Schade pas na al het vuur toepassen: alles gebeurt tegelijk.
  for (const [id, amount] of damage) applyLoss(state, id, amount, events);
}

// ---------------------------------------------------------------------------
// 2. Beweging
//
// Alle bewegende eenheden zetten per "tik" één stap, tegelijk. Per tik:
//  - staat er op de volgende hex een vijand, of komen twee vijanden op dezelfde hex uit: stoppen (contact);
//  - staat er een eigen eenheid, of wil een eigen eenheid met een lagere id dezelfde hex in: even wachten;
//  - wie na een stap naast een vijand staat, stopt (contact). Het restant van het pad vervalt.
// ---------------------------------------------------------------------------

interface Mover {
  unit: Unit;
  path: Hex[];
  step: number;
  spent: number;
  waited: number;
  done: boolean;
  traveled: Hex[];
}

function moveAll(state: GameState, events: GameEvent[]): void {
  const movers: Mover[] = [];
  for (const unit of aliveUnits(state.units)) {
    const order = orderOf(state, unit);
    if ((order?.kind === 'move' || order?.kind === 'attack') && order.path.length > 0) {
      movers.push({
        unit,
        path: order.path,
        step: 0,
        spent: 0,
        waited: 0,
        done: false,
        traveled: [],
      });
    }
  }
  const halted = (m: Mover, reason: 'contact' | 'blocked') => {
    m.done = true;
    events.push({ type: 'halted', unitId: m.unit.id, side: m.unit.side, at: m.unit.hex, reason });
  };

  for (let tick = 0; tick < 30 && movers.some((m) => !m.done); tick++) {
    const occupied = new Map(aliveUnits(state.units).map((u) => [hexKey(u.hex), u]));
    // Wie wil waarheen?
    const wants = new Map<string, Mover[]>();
    for (const m of movers) {
      if (m.done) continue;
      const next = m.path[m.step];
      if (!next) {
        m.done = true;
        continue;
      }
      const cost = moveCost(state.map, state.catalog, unitTypeOf(state.catalog, m.unit), next);
      if (cost === null || m.spent + cost > unitTypeOf(state.catalog, m.unit).movement) {
        halted(m, 'blocked');
        continue;
      }
      const there = occupied.get(hexKey(next));
      if (there && there.side !== m.unit.side) {
        halted(m, 'contact');
        continue;
      }
      if (there) {
        // Eigen eenheid in de weg: wachten. Na drie tikken wachten geeft de eenheid het op.
        m.waited += 1;
        if (m.waited > 3) halted(m, 'blocked');
        continue;
      }
      const list = wants.get(hexKey(next)) ?? [];
      list.push(m);
      wants.set(hexKey(next), list);
    }
    // Conflicten oplossen en stappen zetten.
    for (const list of wants.values()) {
      const sides = new Set(list.map((m) => m.unit.side));
      if (sides.size > 1) {
        for (const m of list) halted(m, 'contact');
        continue;
      }
      const [first, ...others] = list; // al gesorteerd op id
      for (const m of others) m.waited += 1;
      const next = first!.path[first!.step]!;
      first!.spent += moveCost(
        state.map,
        state.catalog,
        unitTypeOf(state.catalog, first!.unit),
        next,
      )!;
      first!.unit.hex = next;
      first!.traveled.push(next);
      first!.step += 1;
    }
    // Contact: wie nu naast een vijand staat, stopt.
    for (const m of movers) {
      if (m.done || m.traveled.length === 0) continue;
      if (hexKey(m.traveled.at(-1)!) !== hexKey(m.unit.hex)) continue;
      const nextToEnemy = aliveUnits(state.units).some(
        (u) => u.side !== m.unit.side && hexDistance(u.hex, m.unit.hex) === 1,
      );
      if (nextToEnemy && m.step < m.path.length) halted(m, 'contact');
    }
  }
  for (const m of movers) {
    if (m.traveled.length > 0)
      events.push({ type: 'move', unitId: m.unit.id, side: m.unit.side, path: m.traveled });
  }
}

// ---------------------------------------------------------------------------
// 3. Gevecht
// ---------------------------------------------------------------------------

function combatPhase(state: GameState, events: GameEvent[]): void {
  const losses = new Map<string, number>();
  const retreats: { defenderId: string; attackerHex: Hex }[] = [];
  const units = aliveUnits(state.units);

  for (const attacker of units) {
    const order = orderOf(state, attacker);
    if (order?.kind !== 'attack') continue;
    const defender = state.units[order.targetId];
    if (!defender) {
      events.push({
        type: 'attackCancelled',
        unitId: attacker.id,
        side: attacker.side,
        targetId: order.targetId,
        reason: 'gone',
      });
      continue;
    }
    if (hexDistance(attacker.hex, defender.hex) !== 1) {
      events.push({
        type: 'attackCancelled',
        unitId: attacker.id,
        side: attacker.side,
        targetId: defender.id,
        reason: 'notAdjacent',
      });
      continue;
    }
    const supporters = units.filter(
      (u) =>
        u.side === attacker.side && u.id !== attacker.id && hexDistance(u.hex, defender.hex) === 1,
    );
    const odds = computeOdds({
      map: state.map,
      catalog: state.catalog,
      attacker,
      defender,
      defenderDefending: orderOf(state, defender)?.kind === 'defend',
      supporters,
    });
    const roll = rollD6(state.rng);
    const result = combatResult(odds, roll);
    losses.set(attacker.id, (losses.get(attacker.id) ?? 0) + result.attacker);
    losses.set(defender.id, (losses.get(defender.id) ?? 0) + result.defender);
    if (result.retreat) retreats.push({ defenderId: defender.id, attackerHex: attacker.hex });
    events.push({
      type: 'combat',
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerSide: attacker.side,
      attack: odds.attack,
      defense: odds.defense,
      column: odds.column,
      roll,
      attackerLoss: result.attacker,
      defenderLoss: result.defender,
      retreat: result.retreat,
      notes: odds.notes,
    });
  }
  // Verliezen tegelijk toepassen, daarna terugtrekken.
  for (const [id, amount] of [...losses].sort(([a], [b]) => (a < b ? -1 : 1)))
    applyLoss(state, id, amount, events);
  for (const { defenderId, attackerHex } of retreats) {
    const unit = state.units[defenderId];
    if (unit) retreat(state, unit, attackerHex, events);
  }
}

function retreat(state: GameState, unit: Unit, from: Hex, events: GameEvent[]): void {
  const type = unitTypeOf(state.catalog, unit);
  const units = aliveUnits(state.units);
  const options = hexNeighbors(unit.hex)
    .filter((hex) => moveCost(state.map, state.catalog, type, hex) !== null)
    .filter((hex) => !unitAt(units, hex))
    .filter((hex) => hexDistance(hex, from) > hexDistance(unit.hex, from))
    .map((hex) => ({
      hex,
      enemiesNear: units.filter((u) => u.side !== unit.side && hexDistance(u.hex, hex) === 1)
        .length,
    }))
    .sort((a, b) => a.enemiesNear - b.enemiesNear || (hexKey(a.hex) < hexKey(b.hex) ? -1 : 1));
  const choice = options[0];
  const origin = unit.hex;
  if (choice) {
    unit.hex = choice.hex;
    events.push({
      type: 'retreat',
      unitId: unit.id,
      side: unit.side,
      from: origin,
      to: choice.hex,
    });
  } else {
    events.push({ type: 'retreat', unitId: unit.id, side: unit.side, from: origin, to: null });
    applyLoss(state, unit.id, NO_RETREAT_EXTRA_LOSS, events);
  }
}

function applyLoss(state: GameState, unitId: string, amount: number, events: GameEvent[]): void {
  const unit = state.units[unitId];
  if (!unit || amount <= 0) return;
  unit.strength = Math.max(0, unit.strength - amount);
  if (unit.strength === 0) {
    delete state.units[unitId];
    state.destroyed[unitId] = { ...unit, turn: state.turn };
    events.push({ type: 'destroyed', unitId, side: unit.side, at: unit.hex });
  }
}

// ---------------------------------------------------------------------------
// 4. Herstel en 5. Doelen
// ---------------------------------------------------------------------------

function resupplyPhase(state: GameState, events: GameEvent[]): void {
  const units = aliveUnits(state.units);
  const suppliers = units.filter((u) => unitTypeOf(state.catalog, u).supplyRange > 0);
  for (const unit of units) {
    const type = unitTypeOf(state.catalog, unit);
    if (unit.strength >= type.maxStrength) continue;
    const supplied = suppliers.some(
      (s) =>
        s.side === unit.side &&
        hexDistance(s.hex, unit.hex) <= unitTypeOf(state.catalog, s).supplyRange,
    );
    if (!supplied) continue;
    const amount = Math.min(RESUPPLY_AMOUNT, type.maxStrength - unit.strength);
    unit.strength += amount;
    events.push({ type: 'resupplied', unitId: unit.id, side: unit.side, amount });
  }
}

function objectivePhase(state: GameState, events: GameEvent[]): void {
  const units = aliveUnits(state.units);
  for (const objective of state.objectives) {
    const occupant = unitAt(units, objective.hex);
    if (occupant && occupant.side !== objective.controller) {
      events.push({
        type: 'captured',
        objectiveId: objective.id,
        side: occupant.side,
        from: objective.controller,
      });
      objective.controller = occupant.side;
    }
  }
}

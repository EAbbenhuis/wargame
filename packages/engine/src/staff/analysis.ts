// Eenvoudige analyse van de situatie, alleen op basis van wat de speler ziet (PlayerView).
// Gebruikt door de scripted staf. Geen spelregels: berekeningen lopen via engine-functies.

import { hexDistance, hexKey } from '../hex/hex.ts';
import { computeOdds, type CombatOdds } from '../rules/combat.ts';
import { terrainAt, unitTypeOf } from '../rules/map.ts';
import { reachablePaths } from '../rules/movement.ts';
import { intentToOrder } from '../rules/orders.ts';
import type { Hex, Objective, Unit } from '../types.ts';
import type { KnownEnemy, PlayerView } from '../view.ts';
import type { StaffProposal } from './types.ts';

export function pct(n: number, of: number): string {
  return `${Math.round((100 * n) / Math.max(1, of))}%`;
}

export function hexLabel(view: PlayerView, hex: Hex): string {
  const place = view.map.placeNames.find((p) => hexDistance(p.hex, hex) <= 1);
  const col = hex.q + (hex.r - (hex.r & 1)) / 2;
  return place ? `bij ${place.name} (${col},${hex.r})` : `(${col},${hex.r})`;
}

export function typeName(view: PlayerView, typeId: string): string {
  return view.catalog.unitTypes[typeId]?.name ?? typeId;
}

/** Verdediging van een vijand op zijn huidige plek (zonder te weten of hij ingegraven is). */
export function enemyDefense(view: PlayerView, enemy: KnownEnemy): number {
  const type = view.catalog.unitTypes[enemy.type];
  if (!type) return 0;
  const terrain = terrainAt(view.map, view.catalog, enemy.hex);
  return ((type.defense * enemy.strength) / type.maxStrength) * (terrain?.defenseMultiplier ?? 1);
}

export interface AttackOption {
  unit: Unit;
  enemy: KnownEnemy;
  odds: CombatOdds;
  proposal: StaffProposal;
}

/** Alle aanvallen die deze beurt mogelijk zijn, beste kansen eerst. */
export function attackOptions(view: PlayerView): AttackOption[] {
  const options: AttackOption[] = [];
  for (const unit of view.ownUnits) {
    if (unitTypeOf(view.catalog, unit).attack <= 0) continue;
    for (const enemy of view.enemies) {
      const result = intentToOrder(view, { kind: 'attack', unitId: unit.id, targetId: enemy.id });
      if (!result.ok || result.order.kind !== 'attack') continue;
      const from = result.order.path.at(-1) ?? unit.hex;
      const odds = computeOdds({
        map: view.map,
        catalog: view.catalog,
        attacker: { type: unit.type, hex: from, strength: unit.strength },
        defender: enemy,
      });
      options.push({
        unit,
        enemy,
        odds,
        proposal: {
          intent: { kind: 'attack', unitId: unit.id, targetId: enemy.id },
          reason: `kansen ${odds.column} (${fmt(odds.attack)} tegen ${fmt(odds.defense)})`,
        },
      });
    }
  }
  return options.sort((a, b) => b.odds.ratio - a.odds.ratio || (a.unit.id < b.unit.id ? -1 : 1));
}

export function fmt(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

/** Vind een doel in de vraag: letter (A, B, C) of (deel van de) naam. */
export function findObjective(view: PlayerView, question: string): Objective | undefined {
  const q = question.toLowerCase();
  const byName = view.objectives.find((o) => q.includes(o.name.toLowerCase()));
  if (byName) return byName;
  const letter = q.match(/\bdoel\s+([a-z])\b/) ?? question.match(/\b([A-Z])\b/);
  if (letter) return view.objectives.find((o) => o.id.toLowerCase() === letter[1]!.toLowerCase());
  return undefined;
}

/**
 * Plan om een doel te nemen: eerst aanvallen op vijanden op of naast het doel (beste kansen),
 * artillerie op de verdediger, daarna de overige gevechtseenheden zo dicht mogelijk erheen.
 */
export function planForObjective(view: PlayerView, objective: Objective): StaffProposal[] {
  const proposals: StaffProposal[] = [];
  const used = new Set<string>();
  const taken = new Set<string>();
  const defenders = view.enemies.filter((e) => hexDistance(e.hex, objective.hex) <= 1);

  // Artillerie op de verdediger van het doel.
  for (const unit of view.ownUnits) {
    const type = unitTypeOf(view.catalog, unit);
    if (type.fireRange <= 0) continue;
    const target = defenders.find(
      (e) => intentToOrder(view, { kind: 'fire', unitId: unit.id, target: e.hex }).ok,
    );
    if (target) {
      proposals.push({
        intent: { kind: 'fire', unitId: unit.id, target: target.hex },
        reason: `vuursteun op ${typeName(view, target.type).toLowerCase()} ${hexLabel(view, target.hex)}`,
      });
      used.add(unit.id);
    }
  }

  // Aanvallen op de verdedigers, maximaal twee per verdediger, alleen bij redelijke kansen.
  const attacks = attackOptions(view).filter(
    (a) => defenders.some((d) => d.id === a.enemy.id) && a.odds.ratio >= 1,
  );
  const perEnemy = new Map<string, number>();
  for (const a of attacks) {
    if (used.has(a.unit.id) || (perEnemy.get(a.enemy.id) ?? 0) >= 2) continue;
    const result = intentToOrder(view, a.proposal.intent);
    if (!result.ok || result.order.kind !== 'attack') continue;
    const end = hexKey(result.order.path.at(-1) ?? a.unit.hex);
    if (taken.has(end)) continue;
    taken.add(end);
    used.add(a.unit.id);
    perEnemy.set(a.enemy.id, (perEnemy.get(a.enemy.id) ?? 0) + 1);
    proposals.push({
      ...a.proposal,
      reason: `aanval op de verdediger van ${objective.name}: ${a.proposal.reason}`,
    });
  }

  // Overige gevechtseenheden: zo dicht mogelijk naar het doel.
  const movers = view.ownUnits
    .filter((u) => !used.has(u.id))
    .filter((u) => {
      const t = unitTypeOf(view.catalog, u);
      return t.attack >= 3 && t.fireRange === 0;
    })
    .sort(
      (a, b) =>
        hexDistance(a.hex, objective.hex) - hexDistance(b.hex, objective.hex) ||
        (a.id < b.id ? -1 : 1),
    )
    .slice(0, 3);
  for (const unit of movers) {
    const reach = reachablePaths(view, unit.id);
    let best: Hex | null = null;
    let bestDistance = hexDistance(unit.hex, objective.hex);
    for (const [key, info] of [...reach.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (taken.has(key)) continue;
      const d = hexDistance(info.hex, objective.hex);
      if (d < bestDistance) {
        bestDistance = d;
        best = info.hex;
      }
    }
    if (!best) continue;
    taken.add(hexKey(best));
    proposals.push({
      intent: { kind: 'move', unitId: unit.id, to: best },
      reason:
        bestDistance === 0
          ? `${objective.name} bezetten`
          : `oprukken naar ${objective.name} (nog ${bestDistance} hex)`,
    });
  }
  return proposals;
}

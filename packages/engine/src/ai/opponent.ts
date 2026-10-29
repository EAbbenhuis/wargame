// AI-TEGENSTANDER (regelgebaseerd, "utility AI")
//
// De AI ziet alleen het spelersbeeld van zijn eigen kant: geen informatie achter de fog of war.
// Per eenheid bedenkt hij alle mogelijke orders (blijven staan, naar elke bereikbare hex,
// elke haalbare aanval, artillerievuur) en geeft elke order een score. De hoogste score wint.
//
// Wat de AI belangrijk vindt, staat in de houding (data/postures.ts). De score is een optelsom:
//   doelen     dichter bij / op een doel staan dat we nog niet hebben, of een eigen doel vasthouden
//   aanval     verwachte schade bij de vijand min verwachte eigen schade, als de kans goed genoeg is
//   veiligheid hoeveel vijandelijke dreiging er op een hex staat, gedeeld door onze verdediging
//   terrein    verdedigbaar terrein (bos, stad, heuvel)
//   oprukken   dichter bij de (bekende) vijand komen
//
// Alles is deterministisch: geen toeval, en bij gelijke scores wint de eerste in vaste volgorde.
// Elke order gaat via intentToOrder/validateOrder, dus de AI kan geen ongeldige zet doen.

import { COMBAT_TABLE, FIRE_TABLE, POSTURES, type Posture } from '../data/index.ts';
import { hexDistance, hexKey, type HexKey } from '../hex/hex.ts';
import { computeOdds } from '../rules/combat.ts';
import { terrainAt, unitTypeOf } from '../rules/map.ts';
import { reachablePaths } from '../rules/movement.ts';
import { intentToOrder } from '../rules/orders.ts';
import type { Hex, Order, Unit } from '../types.ts';
import type { PlayerView } from '../view.ts';

interface Candidate {
  order: Order;
  destination: Hex;
  score: number;
  targetId?: string;
}

interface KnownThreat {
  hex: Hex;
  type: string;
  strength: number;
  /** 1 = nu zichtbaar, minder als het een herinnering is. */
  certainty: number;
}

export function findPosture(id: string): Posture {
  return POSTURES.find((p) => p.id === id) ?? POSTURES[0]!;
}

/** Plant orders voor alle eenheden van de kant in `view`. */
export function planOrders(view: PlayerView, postureId: string): Record<string, Order> {
  const posture = findPosture(postureId);
  const threats = knownThreats(view);
  const orders: Record<string, Order> = {};
  const reserved = new Set<HexKey>();
  const claimed = new Map<string, number>(); // doel-id -> aantal eenheden dat erheen gaat
  const attacked = new Map<string, number>(); // vijand-id -> aantal aanvallers
  const destinations: Hex[] = []; // waar eerder geplande eenheden eindigen

  // Volgorde: eerst artillerie (bepaalt niets voor anderen), dan gevechtseenheden, logistiek als laatste.
  const rank = (u: Unit) => {
    const type = unitTypeOf(view.catalog, u);
    return type.fireRange > 0 ? 0 : type.supplyRange > 0 ? 2 : 1;
  };
  const units = [...view.ownUnits].sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : 1));

  for (const unit of units) {
    const candidates = candidatesFor(view, unit, posture, threats, {
      reserved,
      claimed,
      attacked,
      orders,
      destinations,
    });
    let best: Candidate | undefined;
    for (const c of candidates) if (!best || c.score > best.score) best = c;
    if (!best) continue;
    orders[unit.id] = best.order;
    reserved.add(hexKey(best.destination));
    destinations.push(best.destination);
    const objective = view.objectives.find((o) => hexKey(o.hex) === hexKey(best.destination));
    if (objective) claimed.set(objective.id, (claimed.get(objective.id) ?? 0) + 1);
    if (best.targetId) attacked.set(best.targetId, (attacked.get(best.targetId) ?? 0) + 1);
  }
  return orders;
}

function knownThreats(view: PlayerView): KnownThreat[] {
  return [
    ...view.enemies.map((e) => ({ hex: e.hex, type: e.type, strength: e.strength, certainty: 1 })),
    ...view.lastSeen.map((s) => ({
      hex: s.hex,
      type: s.type,
      strength: s.strength,
      certainty: Math.max(0.2, 0.7 - 0.15 * (view.turn - s.turn)),
    })),
  ];
}

interface PlanContext {
  reserved: Set<HexKey>;
  claimed: Map<string, number>;
  attacked: Map<string, number>;
  orders: Record<string, Order>;
  destinations: Hex[];
}

function candidatesFor(
  view: PlayerView,
  unit: Unit,
  posture: Posture,
  threats: KnownThreat[],
  ctx: PlanContext,
): Candidate[] {
  const type = unitTypeOf(view.catalog, unit);
  const candidates: Candidate[] = [];
  const positionScore = (hex: Hex) => scorePosition(view, unit, hex, posture, threats, ctx);

  // Blijven staan en ingraven.
  const stay = positionScore(unit.hex);
  const onOwnObjective = view.objectives.some(
    (o) => o.controller === view.side && hexKey(o.hex) === hexKey(unit.hex),
  );
  candidates.push({
    order: { kind: 'defend' },
    destination: unit.hex,
    score:
      stay +
      (onOwnObjective ? posture.hold : 0) +
      0.5 * posture.safety * threatAt(view, unit.hex, threats) * 0.1,
  });

  // Bewegen naar elke bereikbare hex.
  // (reachablePaths geeft alleen paden die validateOrder ook goedkeurt; endTurn controleert nogmaals.)
  const reach = reachablePaths(view, unit.id);
  const keys = [...reach.keys()].sort();
  for (const key of keys) {
    if (ctx.reserved.has(key)) continue;
    const info = reach.get(key)!;
    candidates.push({
      order: { kind: 'move', path: info.path },
      destination: info.hex,
      score: positionScore(info.hex) - 0.01 * info.cost,
    });
  }

  // Aanvallen.
  if (type.attack > 0) {
    for (const enemy of view.enemies) {
      const result = intentToOrder(view, { kind: 'attack', unitId: unit.id, targetId: enemy.id });
      if (!result.ok || result.order.kind !== 'attack') continue;
      const from = result.order.path.at(-1) ?? unit.hex;
      if (hexKey(from) !== hexKey(unit.hex) && ctx.reserved.has(hexKey(from))) continue;
      // Flank: eerder geplande eigen eenheden die naast het doelwit eindigen.
      const supporters = ctx.destinations
        .filter((hex) => hexDistance(hex, enemy.hex) === 1)
        .map((hex) => ({ type: unit.type, hex, strength: unit.strength }));
      const odds = computeOdds({
        map: view.map,
        catalog: view.catalog,
        attacker: { type: unit.type, hex: from, strength: unit.strength },
        defender: enemy,
        supporters,
      });
      if (odds.ratio < posture.minOdds && supporters.length === 0) continue;
      const column = COMBAT_TABLE[odds.columnIndex]!;
      const avg = (pick: (r: (typeof column.results)[number]) => number) =>
        column.results.reduce((sum, r) => sum + pick(r), 0) / column.results.length;
      const expectedGain = avg((r) => r.defender) + 2 * avg((r) => (r.retreat ? 1 : 0));
      const expectedLoss = avg((r) => r.attacker);
      const onObjective = view.objectives.some((o) => hexKey(o.hex) === hexKey(enemy.hex));
      const score =
        positionScore(from) +
        posture.attack * (expectedGain - expectedLoss) * 0.5 +
        (onObjective ? posture.objective * 0.3 : 0) +
        (enemy.strength <= 3 ? posture.attack * 0.3 : 0);
      candidates.push({ order: result.order, destination: from, score, targetId: enemy.id });
    }
  }

  // Indirect vuur.
  if (type.fireRange > 0) {
    const avgFire = FIRE_TABLE.reduce((a, b) => a + b, 0) / FIRE_TABLE.length;
    for (const enemy of view.enemies) {
      const result = intentToOrder(view, { kind: 'fire', unitId: unit.id, target: enemy.hex });
      if (!result.ok) continue;
      const cover = terrainAt(view.map, view.catalog, enemy.hex)?.cover ?? 0;
      const expected = Math.max(0, avgFire + type.firepower - cover);
      // Het doelwit kan wegtrekken (beide kanten bewegen tegelijk): reken met 70%.
      const score = stay + 3 + posture.attack * expected + (enemy.strength <= expected + 1 ? 3 : 0);
      candidates.push({ order: result.order, destination: unit.hex, score });
    }
  }
  return candidates;
}

/** Dreiging op een hex: hoeveel vijandelijke aanvalskracht er bij kan. */
function threatAt(view: PlayerView, hex: Hex, threats: KnownThreat[]): number {
  let threat = 0;
  for (const t of threats) {
    const type = view.catalog.unitTypes[t.type];
    if (!type) continue;
    const power = (type.attack * t.strength) / type.maxStrength;
    const distance = hexDistance(t.hex, hex);
    if (distance <= 1) threat += power * t.certainty;
    else if (distance <= type.movement / 2 + 1) threat += power * 0.6 * t.certainty;
    if (type.fireRange > 0 && distance <= type.fireRange) threat += type.firepower * t.certainty;
  }
  return threat;
}

function scorePosition(
  view: PlayerView,
  unit: Unit,
  hex: Hex,
  posture: Posture,
  threats: KnownThreat[],
  ctx: PlanContext,
): number {
  const type = unitTypeOf(view.catalog, unit);
  const terrain = terrainAt(view.map, view.catalog, hex);
  const combatUnit = type.attack > 0 && type.fireRange === 0;
  let score = 0;

  // Doelen: kies het aantrekkelijkste doel en beloon voortgang ernaartoe.
  let goalScore = 0;
  for (const objective of view.objectives) {
    const need = objective.controller === view.side ? 0.4 : 1;
    const claims = ctx.claimed.get(objective.id) ?? 0;
    const crowd = 1 / (1 + claims);
    const now = hexDistance(unit.hex, objective.hex);
    const then = hexDistance(hex, objective.hex);
    let s = 0;
    if (then === 0) s = objective.value * need * crowd * (combatUnit ? 1.5 : 0.5);
    else s = objective.value * need * crowd * (0.15 * (now - then) + 1 / (1 + then));
    goalScore = Math.max(goalScore, s);
  }
  score += posture.objective * goalScore * (combatUnit ? 0.5 : 0.1);

  // Samen optrekken: beloon eigen eenheden in de buurt (geen eenzame uitvallen).
  if (combatUnit) {
    const friends = [
      ...view.ownUnits.filter((u) => u.id !== unit.id).map((u) => u.hex),
      ...ctx.destinations,
    ].filter((h) => hexDistance(h, hex) <= 2).length;
    score += 0.8 * Math.min(3, friends);
  }

  // Veiligheid: dreiging gedeeld door onze verdediging op die hex.
  const defense = Math.max(
    0.5,
    ((type.defense * unit.strength) / type.maxStrength) * (terrain?.defenseMultiplier ?? 1),
  );
  score -= posture.safety * (threatAt(view, hex, threats) / defense) * (combatUnit ? 0.6 : 1.5);

  // Terrein.
  score += posture.terrain * ((terrain?.defenseMultiplier ?? 1) - 1);

  // Oprukken naar de dichtstbijzijnde bekende vijand.
  if (threats.length > 0 && combatUnit) {
    const nearest = (h: Hex) => Math.min(...threats.map((t) => hexDistance(t.hex, h)));
    score += posture.advance * 0.5 * (nearest(unit.hex) - nearest(hex));
  }

  // Artillerie: sta op vuurafstand van bekende vijanden, maar niet ernaast.
  if (type.fireRange > 0 && threats.length > 0) {
    const inRange = threats.filter((t) => {
      const d = hexDistance(t.hex, hex);
      return d >= 2 && d <= type.fireRange;
    }).length;
    score += 2.5 * Math.min(2, inRange);
    // Nog te ver weg? Dan richting de vijand, tot op vuurafstand.
    const nearest = (h: Hex) => Math.min(...threats.map((t) => hexDistance(t.hex, h)));
    const gap = (h: Hex) => Math.max(0, nearest(h) - type.fireRange);
    score += 1.2 * (gap(unit.hex) - gap(hex));
  }

  // Logistiek: dicht bij beschadigde eigen eenheden, ver van de vijand.
  if (type.supplyRange > 0) {
    const damaged = view.ownUnits.filter((u) => {
      const t = unitTypeOf(view.catalog, u);
      return (
        u.id !== unit.id &&
        u.strength < t.maxStrength &&
        hexDistance(u.hex, hex) <= type.supplyRange
      );
    });
    score += 3 * damaged.length;
  }

  // Verkenning: blijf buiten bereik, maar kijk ver vooruit (beloon zicht op doelen).
  if (type.vision >= 4) {
    const seen = view.objectives.filter((o) => hexDistance(o.hex, hex) <= type.vision).length;
    score += 1.5 * seen;
  }
  return score;
}

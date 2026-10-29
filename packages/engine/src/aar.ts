// AFTER-ACTION REPORT (scripted)
//
// Na afloop opgebouwd uit de spelgeschiedenis (state.history): wat er gebeurde, de kantelpunten,
// en een paar lessen. Na het einde mag alles getoond worden, ook wat in de fog of war zat.

import { describeEvent, namesFromState, SIDE_NAMES } from './text/describe.ts';
import type { GameEvent, GameState, Side } from './types.ts';

export interface TurningPoint {
  turn: number;
  text: string;
}

export interface AfterActionReport {
  headline: string;
  summary: string;
  turningPoints: TurningPoint[];
  timeline: { turn: number; lines: string[] }[];
  lessons: string[];
  losses: Record<Side, { strength: number; units: string[] }>;
}

export function buildAfterActionReport(state: GameState, side: Side = 'blue'): AfterActionReport {
  const name = namesFromState(state);
  const objectiveName = (id: string) => state.objectives.find((o) => o.id === id)?.name ?? id;
  const say = (e: GameEvent) => describeEvent(e, name, objectiveName);

  const points: (TurningPoint & { weight: number })[] = [];
  const timeline: AfterActionReport['timeline'] = [];
  let previous: Record<Side, number> = { ...state.startStrength };

  for (const record of state.history) {
    const lines: string[] = [];
    for (const e of record.events) {
      if (e.type === 'captured') {
        points.push({ turn: record.turn, text: say(e), weight: 10 });
        lines.push(say(e));
      } else if (e.type === 'destroyed') {
        points.push({ turn: record.turn, text: say(e), weight: 8 });
        lines.push(say(e));
      } else if (e.type === 'combat' && e.attackerLoss + e.defenderLoss >= 5) {
        points.push({ turn: record.turn, text: say(e), weight: 4 + e.defenderLoss });
      } else if (e.type === 'fire' && e.damage >= 3) {
        points.push({ turn: record.turn, text: say(e), weight: 3 });
      }
    }
    const lossBlue = previous.blue - record.strength.blue;
    const lossRed = previous.red - record.strength.red;
    const combats = record.events.filter((e) => e.type === 'combat').length;
    if (combats > 0 || lossBlue > 0 || lossRed > 0) {
      lines.push(`${combats} gevecht(en); verlies Blauw ${lossBlue}, Rood ${lossRed}.`);
    }
    if (Math.abs(lossBlue - lossRed) >= 6) {
      const worse: Side = lossBlue > lossRed ? 'blue' : 'red';
      points.push({
        turn: record.turn,
        text: `Zware beurt voor ${SIDE_NAMES[worse]}: ${Math.max(lossBlue, lossRed)} sterktepunten verloren tegen ${Math.min(lossBlue, lossRed)}.`,
        weight: 6,
      });
    }
    timeline.push({ turn: record.turn, lines: lines.length > 0 ? lines : ['Geen contact.'] });
    previous = record.strength;
  }

  const turningPoints = points
    .sort((a, b) => b.weight - a.weight || a.turn - b.turn)
    .slice(0, 6)
    .sort((a, b) => a.turn - b.turn)
    .map(({ turn, text }) => ({ turn, text }));

  const losses = (s: Side) => {
    const now = Object.values(state.units)
      .filter((u) => u.side === s)
      .reduce((sum, u) => sum + u.strength, 0);
    return {
      strength: state.startStrength[s] - now,
      units: Object.values(state.destroyed)
        .filter((u) => u.side === s)
        .map((u) => `${u.name} (beurt ${u.turn})`),
    };
  };

  const outcome = state.outcome;
  const headline = !outcome
    ? 'Spel nog niet afgelopen'
    : outcome.winner === side
      ? 'Opdracht volbracht'
      : outcome.winner
        ? 'Opdracht mislukt'
        : 'Onbeslist';

  return {
    headline,
    summary: outcome?.summary ?? '',
    turningPoints,
    timeline,
    lessons: lessons(state, side),
    losses: { blue: losses('blue'), red: losses('red') },
  };
}

function lessons(state: GameState, side: Side): string[] {
  const events = state.history.flatMap((r) => r.events);
  const result: string[] = [];
  const ownAttacks = events.filter((e) => e.type === 'combat' && e.attackerSide === side);
  const poorOdds = ownAttacks.filter(
    (e) => e.type === 'combat' && (e.column === '1:2' || e.column === '1:1'),
  );
  if (poorOdds.length >= 3) {
    result.push(
      `We vielen ${poorOdds.length} keer aan met kansen van 1:1 of slechter. Breng eerst overmacht bij elkaar of zet artillerie in.`,
    );
  }
  const ownFire = events.filter((e) => e.type === 'fire' && e.side === side);
  if (ownFire.length === 0)
    result.push('De artillerie is niet ingezet. Vuur vóór de aanval verzwakt de verdediger.');
  const cancelled = events.filter((e) => e.type === 'attackCancelled' && e.side === side);
  if (cancelled.length >= 2) {
    result.push(
      `${cancelled.length} aanvallen gingen niet door omdat de vijand wegtrok. Beide partijen bewegen tegelijk: anticipeer.`,
    );
  }
  const halted = events.filter(
    (e) => e.type === 'halted' && e.side === side && e.reason === 'contact',
  );
  if (halted.length >= 3)
    result.push(
      `${halted.length} keer stuitten eenheden onverwacht op de vijand. Meer verkenning vooraf helpt.`,
    );
  const lostBlue =
    state.startStrength[side] -
    Object.values(state.units)
      .filter((u) => u.side === side)
      .reduce((s, u) => s + u.strength, 0);
  const other: Side = side === 'blue' ? 'red' : 'blue';
  const lostRed =
    state.startStrength[other] -
    Object.values(state.units)
      .filter((u) => u.side === other)
      .reduce((s, u) => s + u.strength, 0);
  if (lostBlue > lostRed * 1.5 && lostBlue > 10)
    result.push('Onze verliezen waren veel hoger dan die van de vijand.');
  if (result.length === 0) result.push('Geen opvallende fouten gevonden. Goed geleid.');
  return result;
}

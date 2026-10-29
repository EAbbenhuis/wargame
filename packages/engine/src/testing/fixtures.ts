// Hulpjes voor tests: kleine kaartjes en spellen zonder computerspelers,
// zodat een test precies kan bepalen wat beide kanten doen.
import { createGame, type NewGameOptions } from '../game.ts';
import { offsetToAxial } from '../hex/hex.ts';
import type { GameState, Hex, Scenario, ScenarioObjective, ScenarioUnit } from '../types.ts';

export function openMap(cols = 10, rows = 8): string[] {
  return Array.from({ length: rows }, () => '.'.repeat(cols));
}

export function testScenario(parts: {
  map?: string[];
  units: ScenarioUnit[];
  objectives?: ScenarioObjective[];
  maxTurns?: number;
}): Scenario {
  return {
    id: 'test',
    name: 'Testscenario',
    briefing: 'Test.',
    maxTurns: parts.maxTurns ?? 12,
    map: parts.map ?? openMap(),
    placeNames: [],
    objectives: parts.objectives ?? [],
    units: parts.units,
    victory: { pointsPerStrength: 0.25, margin: 2 },
  };
}

/** Spel waarin beide kanten door de test bestuurd worden. */
export function testGame(
  parts: Parameters<typeof testScenario>[0],
  options: Omit<NewGameOptions, 'scenario'> = {},
): GameState {
  return createGame({
    seed: 1,
    controllers: { blue: { kind: 'human' }, red: { kind: 'human' } },
    ...options,
    scenario: testScenario(parts),
  });
}

export function unit(
  id: string,
  side: 'blue' | 'red',
  type: string,
  col: number,
  row: number,
): ScenarioUnit {
  return { id, side, type, name: id, col, row };
}

/** Offset (kolom, rij) naar hex. Leest prettiger in tests. */
export function at(col: number, row: number): Hex {
  return offsetToAxial({ col, row });
}

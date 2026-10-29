// Publieke ingang van de engine. De web-app en de server importeren alleen hieruit.
// Wil je iets uit de engine in de web-app gebruiken? Exporteer het hier.

export * from './types.ts';
export { createGame, applyAction, replay, findScenario, type NewGameOptions } from './game.ts';
export { getPlayerView, opponentOf, type PlayerView, type KnownEnemy } from './view.ts';
export {
  axialToOffset,
  hexDistance,
  hexEquals,
  hexKey,
  hexNeighbors,
  offsetToAxial,
  parseHexKey,
  type OffsetCoord,
} from './hex/hex.ts';
export { findPath, reachableHexes, reachablePaths, type ReachInfo } from './rules/movement.ts';
export { intentToOrder, validateOrder, type IntentResult } from './rules/orders.ts';
export { computeOdds, type CombatOdds } from './rules/combat.ts';
export { terrainAt, unitTypeOf } from './rules/map.ts';
export { computeScore } from './rules/victory.ts';
export { planOrders, findPosture } from './ai/opponent.ts';
export { autoPlayTurn, autoPlayUntil } from './ai/autoplay.ts';
export {
  defaultCatalog,
  POSTURES,
  SCENARIOS,
  TERRAINS,
  UNIT_TYPES,
  type Posture,
} from './data/index.ts';
export {
  describeEvent,
  describeHex,
  namesFromState,
  namesFromView,
  SIDE_NAMES,
  type NameLookup,
} from './text/describe.ts';
export * from './staff/index.ts';

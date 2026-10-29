// Alle typen van de engine op één plek: data (eenheden, terrein, scenario's),
// de speltoestand, orders, acties en gebeurtenissen.
//
// Vuistregel: de speltoestand is gewone JSON. Geen klassen, geen functies erin.
// Daardoor is hij te kopiëren, op te slaan, te vergelijken en na te spelen.

import type { Hex, HexKey } from './hex/hex.ts';
import type { RngState } from './rng.ts';

export type Side = 'blue' | 'red';

// ---------------------------------------------------------------------------
// Data: eenheidstypes, terrein, scenario's (zie packages/engine/src/data/)
// ---------------------------------------------------------------------------

/**
 * Symbool van een eenheid, als lijst van eenvoudige tekenvormen in een kader van 100 x 60.
 * De web-app tekent deze vormen; zo kan een nieuw eenheidstype een eigen symbool krijgen
 * zonder code in de web-app aan te raken.
 */
export type IconShape =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; filled?: boolean }
  | { kind: 'circle'; cx: number; cy: number; r: number; filled?: boolean }
  | { kind: 'polyline'; points: [number, number][]; closed?: boolean; filled?: boolean }
  | { kind: 'text'; x: number; y: number; text: string; size?: number };

export interface UnitType {
  /** Unieke sleutel, bijvoorbeeld infantry. Wordt in scenario's gebruikt. */
  id: string;
  /** Naam in het spel, in het Nederlands. */
  name: string;
  /** Korte afkorting op de kaart, bijvoorbeeld 'INF'. */
  short: string;
  description: string;
  /** Bewegingspunten per beurt. Terrein kost punten (zie terrains.ts). */
  movement: number;
  /** Bewegingsklasse: bepaalt de terreinkosten. Bijvoorbeeld 'foot', 'tracked', 'wheeled'. */
  movementClass: string;
  /** Aanvalswaarde bij volle sterkte. 0 = kan niet aanvallen. */
  attack: number;
  /** Verdedigingswaarde bij volle sterkte. */
  defense: number;
  /** Sterkte bij volle bezetting (sterktepunten). */
  maxStrength: number;
  /** Zichtafstand in hexen. */
  vision: number;
  /** Indirect vuur: bereik in hexen (0 = geen indirect vuur). */
  fireRange: number;
  /** Vuurkracht van indirect vuur (telt op bij de worp, zie data/combatTables.ts). */
  firepower: number;
  /** Bevoorrading: eigen eenheden binnen dit bereik herstellen per beurt (0 = geen). */
  supplyRange: number;
  /** Het symbool (zie IconShape). */
  icon: IconShape[];
}

export interface TerrainType {
  id: string;
  name: string;
  /** Eén teken waarmee dit terrein in een scenariokaart getekend wordt. */
  symbol: string;
  /** Kleur op de kaart. */
  color: string;
  /** Bewegingskosten per bewegingsklasse. `default` geldt voor klassen die niet genoemd zijn. null = onbegaanbaar. */
  moveCost: { default: number | null; [movementClass: string]: number | null };
  /** Verdediging wordt hiermee vermenigvuldigd (1 = geen voordeel). */
  defenseMultiplier: number;
  /** Dekking tegen indirect vuur: zoveel schade minder. */
  cover: number;
  /** Blokkeert dit terrein de zichtlijn naar hexen erachter? */
  blocksSight: boolean;
  /** Hoogte (0 of 1). Een eenheid op hoogte kijkt over lager blokkerend terrein heen. */
  elevation: number;
  /** Extra zichtafstand voor een eenheid die hier staat (bijvoorbeeld op een heuvel). */
  visionBonus: number;
  /** Kolomverschuiving als een eenheid VANUIT dit terrein aanvalt (bijvoorbeeld -1 vanuit een rivier). */
  attackFromShift?: number;
  /** Optioneel patroon dat de web-app over de kleur tekent. */
  pattern?: 'trees' | 'buildings' | 'waves' | 'contour' | 'planks' | 'reeds';
}

export interface ScenarioUnit {
  id: string;
  side: Side;
  type: string;
  name: string;
  col: number;
  row: number;
}

export interface ScenarioObjective {
  id: string;
  name: string;
  col: number;
  row: number;
  /** Punten voor wie het doel aan het eind bezit. */
  value: number;
  /** Wie het doel bij de start bezit. */
  controller: Side | null;
}

export interface Scenario {
  id: string;
  name: string;
  /** Opdracht voor de speler, in gewone taal. */
  briefing: string;
  maxTurns: number;
  /** Kaart als tekst: één regel per rij, één teken per hex (zie TerrainType.symbol). */
  map: string[];
  placeNames: { name: string; col: number; row: number }[];
  objectives: ScenarioObjective[];
  units: ScenarioUnit[];
  /** Overwinningsvoorwaarden. */
  victory: {
    /** Punten per verloren sterktepunt van de tegenstander. */
    pointsPerStrength: number;
    /** Verschil in punten dat nodig is voor een overwinning; daaronder is het onbeslist. */
    margin: number;
  };
  /** Wie speelt welke kant. Standaard: blauw mens, rood computer. */
  controllers?: Partial<Record<Side, Controller>>;
}

export interface Catalog {
  unitTypes: Record<string, UnitType>;
  terrains: Record<string, TerrainType>;
}

// ---------------------------------------------------------------------------
// Speltoestand
// ---------------------------------------------------------------------------

export type Controller = { kind: 'human' } | { kind: 'ai'; posture: string };

export interface Unit {
  id: string;
  side: Side;
  type: string;
  name: string;
  hex: Hex;
  strength: number;
}

export interface Objective {
  id: string;
  name: string;
  hex: Hex;
  value: number;
  controller: Side | null;
}

export interface GameMap {
  cols: number;
  rows: number;
  /** Terrein-id per hex, op volgorde rij voor rij (index = row * cols + col). */
  terrain: string[];
  placeNames: { name: string; hex: Hex }[];
}

/** Wat een kant zich herinnert van een vijandelijke eenheid die nu uit zicht is. */
export interface LastSeen {
  unitId: string;
  type: string;
  hex: Hex;
  strength: number;
  turn: number;
}

export interface TurnRecord {
  turn: number;
  events: GameEvent[];
  strength: Record<Side, number>;
  objectives: Record<string, Side | null>;
}

export interface Outcome {
  winner: Side | null;
  score: Record<Side, number>;
  /** Uitleg in gewone taal. */
  summary: string;
}

export interface GameState {
  scenarioId: string;
  scenarioName: string;
  briefing: string;
  seed: number;
  rng: RngState;
  turn: number;
  maxTurns: number;
  phase: 'planning' | 'ended';
  catalog: Catalog;
  map: GameMap;
  units: Record<string, Unit>;
  /** Vernietigde eenheden (voor het after-action report). */
  destroyed: Record<string, Unit & { turn: number }>;
  objectives: Objective[];
  orders: Record<Side, Record<string, Order>>;
  ready: Record<Side, boolean>;
  controllers: Record<Side, Controller>;
  lastSeen: Record<Side, Record<string, LastSeen>>;
  startStrength: Record<Side, number>;
  victory: Scenario['victory'];
  history: TurnRecord[];
  outcome: Outcome | null;
}

// ---------------------------------------------------------------------------
// Orders: wat een eenheid deze beurt gaat doen. Beide kanten plannen tegelijk,
// daarna voert de engine alles tegelijk uit (zie rules/resolveTurn.ts).
// ---------------------------------------------------------------------------

export type Order =
  /** Verplaats langs dit pad (zonder de starthex). */
  | { kind: 'move'; path: Hex[] }
  /** Verplaats langs dit pad en val daarna deze vijandelijke eenheid aan, als die dan naast je staat. */
  | { kind: 'attack'; path: Hex[]; targetId: string }
  /** Indirect vuur op een hex (artillerie). Wordt uitgevoerd vóór alle beweging. */
  | { kind: 'fire'; target: Hex }
  /** Blijf staan en graaf in: betere verdediging deze beurt. */
  | { kind: 'defend' };

/**
 * Een voorstel in "gewone" termen: waar naartoe of wie aanvallen. De engine vertaalt een
 * intentie naar een order met pad (zie rules/orders.ts). De AI-staf werkt met intenties.
 */
export type OrderIntent =
  | { kind: 'move'; unitId: string; to: Hex }
  | { kind: 'attack'; unitId: string; targetId: string }
  | { kind: 'fire'; unitId: string; target: Hex }
  | { kind: 'defend'; unitId: string };

// ---------------------------------------------------------------------------
// Acties: het enige dat de toestand verandert. applyAction(state, action).
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'setOrder'; side: Side; unitId: string; order: Order }
  | { type: 'clearOrder'; side: Side; unitId: string }
  /** Klaar met plannen. Speelt de computer de andere kant, dan plant die nu en wordt de beurt uitgevoerd. */
  | { type: 'endTurn'; side: Side }
  /** Verander de houding van een computerspeler (bijvoorbeeld 'aggressive'). */
  | { type: 'setPosture'; side: Side; posture: string };

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string; state: GameState };

// ---------------------------------------------------------------------------
// Gebeurtenissen: wat er tijdens het uitvoeren van een beurt gebeurde.
// Gebruikt voor het beurtverslag, de animatie en het after-action report.
// ---------------------------------------------------------------------------

export type GameEvent =
  | {
      type: 'fire';
      unitId: string;
      side: Side;
      target: Hex;
      targetUnitId: string | null;
      roll: number;
      damage: number;
    }
  | { type: 'move'; unitId: string; side: Side; path: Hex[] }
  | { type: 'halted'; unitId: string; side: Side; at: Hex; reason: 'contact' | 'blocked' }
  | {
      type: 'combat';
      attackerId: string;
      defenderId: string;
      attackerSide: Side;
      attack: number;
      defense: number;
      column: string;
      roll: number;
      attackerLoss: number;
      defenderLoss: number;
      retreat: boolean;
      notes: string[];
    }
  | {
      type: 'attackCancelled';
      unitId: string;
      side: Side;
      targetId: string;
      reason: 'gone' | 'notAdjacent';
    }
  | { type: 'retreat'; unitId: string; side: Side; from: Hex; to: Hex | null }
  | { type: 'destroyed'; unitId: string; side: Side; at: Hex }
  | { type: 'resupplied'; unitId: string; side: Side; amount: number }
  | { type: 'captured'; objectiveId: string; side: Side; from: Side | null };

export type { Hex, HexKey };

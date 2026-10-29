// TERREINSOORTEN
//
// Uitbreidingspunt "nieuw terrein": voeg hieronder een object toe aan TERRAINS en geef het
// een eigen `symbol` (één teken). Daarna kun je dat teken in een scenariokaart gebruiken.
//
// Velden (zie `TerrainType` in ../types.ts):
//   moveCost          bewegingskosten per bewegingsklasse; `default` voor de rest; null = onbegaanbaar
//   defenseMultiplier verdediging x dit getal (1 = geen voordeel, 2 = dubbel zo sterk)
//   cover             dekking tegen artillerie: zoveel schade minder
//   blocksSight       blokkeert het zicht naar wat erachter ligt
//   elevation         hoogte: 1 = je kijkt vanaf hier over bos en stad heen
//   visionBonus       extra zichtafstand voor een eenheid die hier staat
//   attackFromShift   (optioneel) kolommen verschuiven bij een aanval vanuit dit terrein
//   color / pattern   hoe de web-app het tekent

import type { TerrainType } from '../types.ts';

export const TERRAINS: TerrainType[] = [
  {
    id: 'open',
    name: 'Open terrein',
    symbol: '.',
    color: '#ece4c8',
    moveCost: { default: 1 },
    defenseMultiplier: 1,
    cover: 0,
    blocksSight: false,
    elevation: 0,
    visionBonus: 0,
  },
  {
    id: 'forest',
    name: 'Bos',
    symbol: 'B',
    color: '#b9cf9a',
    moveCost: { default: 2, tracked: 3, wheeled: 3 },
    defenseMultiplier: 1.5,
    cover: 1,
    blocksSight: true,
    elevation: 0,
    visionBonus: 0,
    pattern: 'trees',
  },
  {
    id: 'city',
    name: 'Stad',
    symbol: 'S',
    color: '#d6c3a5',
    moveCost: { default: 1, tracked: 2 },
    defenseMultiplier: 2,
    cover: 2,
    blocksSight: true,
    elevation: 0,
    visionBonus: 0,
    pattern: 'buildings',
  },
  {
    id: 'river',
    name: 'Rivier',
    symbol: '~',
    color: '#a9c8de',
    // Te voet kost oversteken een hele beurt; voertuigen kunnen er niet door.
    moveCost: { default: 3, tracked: null, wheeled: null },
    defenseMultiplier: 0.7,
    cover: 0,
    blocksSight: false,
    elevation: 0,
    visionBonus: 0,
    attackFromShift: -1,
    pattern: 'waves',
  },
  {
    id: 'hill',
    name: 'Heuvel',
    symbol: 'H',
    color: '#ddc99a',
    moveCost: { default: 2 },
    defenseMultiplier: 1.5,
    cover: 1,
    blocksSight: true,
    elevation: 1,
    visionBonus: 2,
    pattern: 'contour',
  },
  {
    id: 'bridge',
    name: 'Brug',
    symbol: '=',
    color: '#c9b79a',
    moveCost: { default: 1 },
    defenseMultiplier: 0.8,
    cover: 0,
    blocksSight: false,
    elevation: 0,
    visionBonus: 0,
    pattern: 'planks',
  },
];

// EENHEIDSTYPES
//
// Uitbreidingspunt "nieuwe eenheid": voeg hieronder een object toe aan UNIT_TYPES.
// Meer is niet nodig: beweging, gevecht, zicht, de AI en de kaart lezen alles uit deze lijst.
// Daarna kun je de eenheid in een scenario gebruiken (zie scenarios/) met `type: '<id>'`.
//
// Uitleg van de velden staat bij `UnitType` in ../types.ts. Kort:
//   movement      bewegingspunten per beurt (terrein kost punten, zie terrains.ts)
//   movementClass 'foot' (te voet), 'tracked' (rupsvoertuig) of 'wheeled' (wielvoertuig)
//   attack        aanvalswaarde bij volle sterkte (0 = valt niet aan)
//   defense       verdedigingswaarde bij volle sterkte
//   maxStrength   sterktepunten bij volle bezetting
//   vision        zichtafstand in hexen
//   fireRange     bereik van indirect vuur (0 = geen); firepower = kracht van dat vuur
//   supplyRange   eigen eenheden binnen dit bereik herstellen elke beurt (0 = geen)
//   icon          het symbool: vormen in een kader van 100 breed en 60 hoog
//
// Alles is fictief en vereenvoudigd; de getallen zijn spelwaarden, geen echte specificaties.

import type { UnitType } from '../types.ts';

export const UNIT_TYPES: UnitType[] = [
  {
    id: 'infantry',
    name: 'Infanterie',
    short: 'INF',
    description: 'Taai in de verdediging, vooral in bos en stad. Langzaam.',
    movement: 3,
    movementClass: 'foot',
    attack: 4,
    defense: 5,
    maxStrength: 10,
    vision: 3,
    fireRange: 0,
    firepower: 0,
    supplyRange: 0,
    // NAVO-achtig: een kruis door het kader.
    icon: [
      { kind: 'line', x1: 0, y1: 0, x2: 100, y2: 60 },
      { kind: 'line', x1: 100, y1: 0, x2: 0, y2: 60 },
    ],
  },
  {
    id: 'armor',
    name: 'Pantser',
    short: 'PA',
    description:
      'Snel en sterk in de aanval op open terrein. Kan niet door een rivier, alleen over een brug.',
    movement: 5,
    movementClass: 'tracked',
    attack: 7,
    defense: 5,
    maxStrength: 10,
    vision: 2,
    fireRange: 0,
    firepower: 0,
    supplyRange: 0,
    // Een rupsband: ovaal in het kader.
    icon: [{ kind: 'ellipse', cx: 50, cy: 30, rx: 34, ry: 15 }],
  },
  {
    id: 'artillery',
    name: 'Artillerie',
    short: 'ART',
    description:
      'Vuurt op afstand (2 of 3 hexen) op een hex die je kunt zien. Kwetsbaar van dichtbij.',
    movement: 3,
    movementClass: 'tracked',
    attack: 1,
    defense: 2,
    maxStrength: 10,
    vision: 2,
    fireRange: 3,
    firepower: 2,
    supplyRange: 0,
    // Een gevulde stip in het midden.
    icon: [{ kind: 'circle', cx: 50, cy: 30, r: 9, filled: true }],
  },
  {
    id: 'recon',
    name: 'Verkenning',
    short: 'VK',
    description: 'Ziet ver en is snel, maar zwak in een gevecht. De ogen van de brigade.',
    movement: 6,
    movementClass: 'wheeled',
    attack: 2,
    defense: 2,
    maxStrength: 10,
    vision: 5,
    fireRange: 0,
    firepower: 0,
    supplyRange: 0,
    // Eén schuine streep.
    icon: [{ kind: 'line', x1: 0, y1: 60, x2: 100, y2: 0 }],
  },
  {
    id: 'logistics',
    name: 'Logistiek',
    short: 'LOG',
    description:
      'Vecht niet, maar herstelt eigen eenheden die ernaast staan met 1 sterktepunt per beurt.',
    movement: 4,
    movementClass: 'wheeled',
    attack: 0,
    defense: 1,
    maxStrength: 10,
    vision: 2,
    fireRange: 0,
    firepower: 0,
    supplyRange: 1,
    // Een horizontale streep onderin.
    icon: [{ kind: 'line', x1: 0, y1: 45, x2: 100, y2: 45 }],
  },
];

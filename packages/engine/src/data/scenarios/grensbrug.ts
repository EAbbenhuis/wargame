// SCENARIO: Operatie Grensbrug
//
// Uitbreidingspunt "nieuw scenario": kopieer dit bestand, geef het een nieuwe `id`,
// en voeg het toe aan de lijst in ./index.ts.
//
// De kaart is tekst: één regel per rij (van boven naar beneden), één teken per hex.
// De tekens staan in ../terrains.ts:  . open   B bos   S stad   ~ rivier   H heuvel   = brug
// Kolommen en rijen tellen vanaf 0 (linksboven). Oneven rijen schuiven een halve hex op.
//
// Alles is fictief: land, plaatsen en eenheden.

import type { Scenario } from '../../types.ts';

export const GRENSBRUG: Scenario = {
  id: 'grensbrug',
  name: 'Operatie Grensbrug',
  briefing:
    'Roodland heeft de oostoever van de Vaal bezet. Uw brigade moet binnen 12 beurten twee van de drie ' +
    'sleutellocaties in handen hebben: de Grensbrug, het dorp Kruisweide en de Uitkijkheuvel. ' +
    'Pantser kan alleen over een brug de rivier over; infanterie kan waden, maar dat kost een hele beurt. ' +
    'Beide partijen geven tegelijk hun bevelen. Denk dus na over wat de tegenstander gaat doen.',
  maxTurns: 12,
  map: [
    '..BB....~...........',
    '..BBB...~...BBB.....',
    '.........~...BB..SS.',
    '.HH......=.......S..',
    '.H....BB.~..........',
    '......BB.~...SS.....',
    '.........~...SS.BB..',
    '...S.....~........H.',
    '...SS..BB.~B......H.',
    '..........=.B...H...',
    '.....BB...~BB..HH...',
    '.....BBB..~....HH...',
    '.BB........~.BB...BB',
    '...........~..B.....',
  ],
  placeNames: [
    { name: 'Brakhoven', col: 3, row: 8 },
    { name: 'Hoge Lindert', col: 1, row: 3 },
    { name: 'Merelbos', col: 6, row: 11 },
    { name: 'Noorderbrug', col: 9, row: 3 },
    { name: 'Kruisweide', col: 13, row: 5 },
    { name: 'Ostervaal', col: 17, row: 2 },
    { name: 'Uitkijkheuvel', col: 16, row: 10 },
    { name: 'Grensbrug', col: 10, row: 9 },
  ],
  objectives: [
    { id: 'A', name: 'Grensbrug', col: 10, row: 9, value: 3, controller: 'red' },
    { id: 'B', name: 'Kruisweide', col: 14, row: 5, value: 4, controller: 'red' },
    { id: 'C', name: 'Uitkijkheuvel', col: 16, row: 10, value: 3, controller: 'red' },
  ],
  units: [
    // Blauw: de eigen brigade, in het westen.
    { id: 'b-inf-1', side: 'blue', type: 'infantry', name: 'Bataljon Alfa', col: 5, row: 3 },
    { id: 'b-inf-2', side: 'blue', type: 'infantry', name: 'Bataljon Bravo', col: 5, row: 7 },
    { id: 'b-inf-3', side: 'blue', type: 'infantry', name: 'Bataljon Charlie', col: 4, row: 11 },
    { id: 'b-arm-1', side: 'blue', type: 'armor', name: 'Eskadron Delta', col: 3, row: 5 },
    { id: 'b-arm-2', side: 'blue', type: 'armor', name: 'Eskadron Echo', col: 3, row: 10 },
    { id: 'b-art-1', side: 'blue', type: 'artillery', name: 'Batterij Foxtrot', col: 2, row: 7 },
    { id: 'b-rec-1', side: 'blue', type: 'recon', name: 'Verkenners Golf', col: 6, row: 6 },
    { id: 'b-log-1', side: 'blue', type: 'logistics', name: 'Logistiek Hotel', col: 1, row: 8 },
    // Rood: de tegenstander, op de oostoever.
    { id: 'r-inf-1', side: 'red', type: 'infantry', name: 'Bataljon Wolf', col: 13, row: 5 },
    { id: 'r-inf-2', side: 'red', type: 'infantry', name: 'Bataljon Beer', col: 11, row: 9 },
    { id: 'r-inf-3', side: 'red', type: 'infantry', name: 'Bataljon Das', col: 15, row: 10 },
    { id: 'r-arm-1', side: 'red', type: 'armor', name: 'Tankcompagnie Lynx', col: 16, row: 4 },
    { id: 'r-arm-2', side: 'red', type: 'armor', name: 'Tankcompagnie Stier', col: 17, row: 8 },
    { id: 'r-art-1', side: 'red', type: 'artillery', name: 'Batterij Hamer', col: 15, row: 7 },
    { id: 'r-rec-1', side: 'red', type: 'recon', name: 'Verkenners Valk', col: 12, row: 3 },
    { id: 'r-log-1', side: 'red', type: 'logistics', name: 'Logistiek Muildier', col: 18, row: 6 },
  ],
  victory: { pointsPerStrength: 0.25, margin: 2 },
  controllers: { blue: { kind: 'human' }, red: { kind: 'ai', posture: 'balanced' } },
};

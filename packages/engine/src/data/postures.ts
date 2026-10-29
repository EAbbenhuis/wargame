// HOUDINGEN VAN DE AI-TEGENSTANDER
//
// Uitbreidingspunt "nieuwe AI-houding": voeg een object toe aan POSTURES.
// De AI geeft elke mogelijke zet een score (zie ../ai/opponent.ts). De gewichten hieronder
// bepalen wat de AI belangrijk vindt. Hogere waarde = belangrijker.
//
//   objective   doelen bezetten en vasthouden
//   attack      aanvallen als de kansen goed zijn
//   minOdds     de AI valt alleen aan vanaf deze verhouding aanval/verdediging
//   safety      uit de buurt blijven van vijandelijke dreiging
//   terrain     in goed verdedigbaar terrein gaan staan (bos, stad, heuvel)
//   advance     naar de vijand toe trekken
//   hold        blijven staan en ingraven op een doel dat je al bezit

export interface Posture {
  id: string;
  name: string;
  description: string;
  objective: number;
  attack: number;
  minOdds: number;
  safety: number;
  terrain: number;
  advance: number;
  hold: number;
}

export const POSTURES: Posture[] = [
  {
    id: 'balanced',
    name: 'Evenwichtig',
    description: 'Houdt de doelen vast en valt aan als de kansen goed zijn.',
    objective: 10,
    attack: 6,
    minOdds: 1.4,
    safety: 3,
    terrain: 2,
    advance: 1,
    hold: 6,
  },
  {
    id: 'aggressive',
    name: 'Aanvallend',
    description: 'Zoekt het gevecht en trekt naar voren, ook bij matige kansen.',
    objective: 8,
    attack: 10,
    minOdds: 0.9,
    safety: 1,
    terrain: 1,
    advance: 4,
    hold: 2,
  },
  {
    id: 'defensive',
    name: 'Verdedigend',
    description: 'Graaft in bij de doelen en valt alleen aan bij grote overmacht.',
    objective: 14,
    attack: 3,
    minOdds: 2.5,
    safety: 5,
    terrain: 4,
    advance: 0,
    hold: 12,
  },
];

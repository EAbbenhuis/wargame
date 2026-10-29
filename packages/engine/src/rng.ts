// Geseede toevalsgenerator (mulberry32). Dit is de ENIGE bron van toeval in de engine.
// Nooit Math.random gebruiken: dan worden tests wisselvallig en is een spel niet na te spelen.
// De toestand is één getal, zodat hij gewoon in de speltoestand (JSON) past.

export interface RngState {
  seed: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 };
}

/** Getal in [0, 1). Verandert de generator (die hoort bij de gekloonde speltoestand). */
export function nextFloat(rng: RngState): number {
  rng.seed = (rng.seed + 0x6d2b79f5) >>> 0;
  let t = rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Worp met een zeszijdige dobbelsteen: 1 tot en met 6. */
export function rollD6(rng: RngState): number {
  return 1 + Math.floor(nextFloat(rng) * 6);
}

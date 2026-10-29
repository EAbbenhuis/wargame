import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, rollD6 } from './rng.ts';

describe('geseede toevalsgenerator', () => {
  it('geeft bij dezelfde seed dezelfde reeks', () => {
    const a = createRng(42);
    const b = createRng(42);
    const rollsA = Array.from({ length: 20 }, () => rollD6(a));
    const rollsB = Array.from({ length: 20 }, () => rollD6(b));
    expect(rollsA).toEqual(rollsB);
  });

  it('geeft bij een andere seed een andere reeks', () => {
    const a = createRng(1);
    const b = createRng(2);
    const rollsA = Array.from({ length: 20 }, () => rollD6(a));
    const rollsB = Array.from({ length: 20 }, () => rollD6(b));
    expect(rollsA).not.toEqual(rollsB);
  });

  it('gooit alleen 1 tot en met 6, en elke waarde komt voor', () => {
    const rng = createRng(7);
    const rolls = Array.from({ length: 600 }, () => rollD6(rng));
    expect(Math.min(...rolls)).toBe(1);
    expect(Math.max(...rolls)).toBe(6);
    expect(new Set(rolls).size).toBe(6);
  });

  it('bewaart zijn toestand als gewoon getal (past in de speltoestand)', () => {
    const rng = createRng(99);
    nextFloat(rng);
    const copy = JSON.parse(JSON.stringify(rng));
    expect(nextFloat(copy)).toBe(nextFloat(rng));
  });
});

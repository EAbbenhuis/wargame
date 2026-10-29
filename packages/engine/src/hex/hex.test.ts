import { describe, expect, it } from 'vitest';
import {
  axialToOffset,
  hexDistance,
  hexKey,
  hexLine,
  hexNeighbors,
  hexesWithinRange,
  isInBounds,
  offsetToAxial,
  parseHexKey,
} from './hex.ts';

describe('hex-coördinaten', () => {
  it('zet offset (kolom, rij) om naar axiaal en terug', () => {
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 20; col++) {
        expect(axialToOffset(offsetToAxial({ col, row }))).toEqual({ col, row });
      }
    }
  });

  it('kent een sleutel per hex die terug te lezen is', () => {
    const hex = { q: 3, r: -2 };
    expect(parseHexKey(hexKey(hex))).toEqual(hex);
  });

  it('geeft zes unieke buren op afstand 1', () => {
    const center = offsetToAxial({ col: 5, row: 5 });
    const neighbors = hexNeighbors(center);
    expect(neighbors).toHaveLength(6);
    expect(new Set(neighbors.map(hexKey)).size).toBe(6);
    for (const n of neighbors) expect(hexDistance(center, n)).toBe(1);
  });

  it('heeft buren die in offset-coördinaten kloppen voor even en oneven rijen', () => {
    // Puntige hexen, oneven rijen schuiven een halve hex naar rechts ("odd-r").
    const even = hexNeighbors(offsetToAxial({ col: 4, row: 2 })).map(axialToOffset);
    expect(even).toEqual(
      expect.arrayContaining([
        { col: 5, row: 2 },
        { col: 3, row: 2 },
        { col: 3, row: 1 },
        { col: 4, row: 1 },
        { col: 3, row: 3 },
        { col: 4, row: 3 },
      ]),
    );
    const odd = hexNeighbors(offsetToAxial({ col: 4, row: 3 })).map(axialToOffset);
    expect(odd).toEqual(
      expect.arrayContaining([
        { col: 5, row: 3 },
        { col: 3, row: 3 },
        { col: 4, row: 2 },
        { col: 5, row: 2 },
        { col: 4, row: 4 },
        { col: 5, row: 4 },
      ]),
    );
  });

  it('meet afstanden symmetrisch en volgens de driehoeksongelijkheid', () => {
    const a = offsetToAxial({ col: 0, row: 0 });
    const b = offsetToAxial({ col: 7, row: 4 });
    const c = offsetToAxial({ col: 3, row: 9 });
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    expect(hexDistance(a, c)).toBeLessThanOrEqual(hexDistance(a, b) + hexDistance(b, c));
    expect(hexDistance(a, a)).toBe(0);
  });

  it('meet bekende afstanden goed', () => {
    expect(hexDistance(offsetToAxial({ col: 0, row: 0 }), offsetToAxial({ col: 5, row: 0 }))).toBe(
      5,
    );
    expect(hexDistance(offsetToAxial({ col: 0, row: 0 }), offsetToAxial({ col: 0, row: 4 }))).toBe(
      4,
    );
    expect(hexDistance(offsetToAxial({ col: 0, row: 0 }), offsetToAxial({ col: 2, row: 4 }))).toBe(
      4,
    );
    expect(hexDistance(offsetToAxial({ col: 0, row: 0 }), offsetToAxial({ col: 3, row: 4 }))).toBe(
      5,
    );
  });

  it('trekt een lijn van begin tot eind met aaneengesloten hexen', () => {
    const from = offsetToAxial({ col: 1, row: 1 });
    const to = offsetToAxial({ col: 8, row: 6 });
    const line = hexLine(from, to);
    expect(line).toHaveLength(hexDistance(from, to) + 1);
    expect(line[0]).toEqual(from);
    expect(line.at(-1)).toEqual(to);
    for (let i = 1; i < line.length; i++) expect(hexDistance(line[i - 1]!, line[i]!)).toBe(1);
  });

  it('trekt een lijn langs een hexrand deterministisch (zelfde uitkomst, beide richtingen even lang)', () => {
    const from = { q: 0, r: 0 };
    const to = { q: 2, r: -1 }; // precies tussen twee hexen door
    expect(hexLine(from, to)).toEqual(hexLine(from, to));
    expect(hexLine(to, from)).toHaveLength(3);
  });

  it('vindt alle hexen binnen bereik', () => {
    const center = { q: 0, r: 0 };
    expect(hexesWithinRange(center, 0)).toHaveLength(1);
    expect(hexesWithinRange(center, 1)).toHaveLength(7);
    expect(hexesWithinRange(center, 2)).toHaveLength(19);
  });

  it('weet of een hex binnen de kaart ligt', () => {
    const size = { cols: 20, rows: 14 };
    expect(isInBounds(offsetToAxial({ col: 0, row: 0 }), size)).toBe(true);
    expect(isInBounds(offsetToAxial({ col: 19, row: 13 }), size)).toBe(true);
    expect(isInBounds(offsetToAxial({ col: 20, row: 0 }), size)).toBe(false);
    expect(isInBounds(offsetToAxial({ col: 0, row: -1 }), size)).toBe(false);
  });
});

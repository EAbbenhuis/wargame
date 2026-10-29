// Hex-wiskunde: coördinaten, buren, afstand en lijnen.
//
// We gebruiken axiale coördinaten (q, r) met puntige hexen. Op de kaart en in scenario's
// werken we met offset-coördinaten (kolom, rij) waarin oneven rijen een halve hex naar
// rechts schuiven ("odd-r"). Achtergrond: https://www.redblobgames.com/grids/hexagons/
//
// Dit bestand bevat geen spelregels, alleen meetkunde. Alles hier is los getest in hex.test.ts.

export interface Hex {
  readonly q: number;
  readonly r: number;
}

export interface OffsetCoord {
  readonly col: number;
  readonly row: number;
}

export interface MapSize {
  readonly cols: number;
  readonly rows: number;
}

/** Tekstsleutel voor een hex, bruikbaar als key in objecten en sets: "q,r". */
export type HexKey = string;

export function hexKey(hex: Hex): HexKey {
  return `${hex.q},${hex.r}`;
}

export function parseHexKey(key: HexKey): Hex {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function offsetToAxial({ col, row }: OffsetCoord): Hex {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

export function axialToOffset({ q, r }: Hex): OffsetCoord {
  return { col: q + (r - (r & 1)) / 2, row: r };
}

// Vaste volgorde: oost, noordoost, noordwest, west, zuidwest, zuidoost.
const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbors(hex: Hex): Hex[] {
  return DIRECTIONS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function cubeRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // Voorkom -0, zodat sleutels en vergelijkingen altijd kloppen.
  return { q: rq + 0, r: rr + 0 };
}

/**
 * Alle hexen op de rechte lijn van `from` naar `to`, inclusief begin en eind.
 * Een kleine verschuiving (epsilon) zorgt dat een lijn precies langs een hexrand
 * altijd dezelfde kant kiest: deterministisch. Met nudge -1 kies je de andere kant
 * (zichtlijnen proberen beide, zodat zicht symmetrisch is).
 */
export function hexLine(from: Hex, to: Hex, nudge: 1 | -1 = 1): Hex[] {
  const n = hexDistance(from, to);
  if (n === 0) return [from];
  // q en r krijgen een verschillende verschuiving: zo is er nooit een gelijkspel bij het afronden,
  // ook niet op een hoekpunt waar drie hexen samenkomen.
  const eq = 1e-6 * nudge;
  const er = 2e-6 * nudge;
  const aq = from.q + eq;
  const ar = from.r + er;
  const bq = to.q + eq;
  const br = to.r + er;
  const result: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    result.push(cubeRound(aq + (bq - aq) * t, ar + (br - ar) * t));
  }
  return result;
}

export function hexesWithinRange(center: Hex, range: number): Hex[] {
  const result: Hex[] = [];
  for (let dq = -range; dq <= range; dq++) {
    for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++) {
      result.push({ q: center.q + dq, r: center.r + dr });
    }
  }
  return result;
}

export function isInBounds(hex: Hex, size: MapSize): boolean {
  const { col, row } = axialToOffset(hex);
  return col >= 0 && col < size.cols && row >= 0 && row < size.rows;
}

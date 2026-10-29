// Van hex naar pixels (puntige hexen). Alleen tekenwerk, geen spelregels.
import type { Hex } from '@wargame/engine';

export const HEX_SIZE = 30;
const SQRT3 = Math.sqrt(3);
export const MARGIN = 8;

export function hexToPixel(hex: Hex): { x: number; y: number } {
  return {
    x: MARGIN + HEX_SIZE * SQRT3 * (hex.q + hex.r / 2) + (HEX_SIZE * SQRT3) / 2,
    y: MARGIN + HEX_SIZE * 1.5 * hex.r + HEX_SIZE,
  };
}

export function hexCorners(hex: Hex, size = HEX_SIZE): string {
  const { x, y } = hexToPixel(hex);
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${(x + size * Math.cos(angle)).toFixed(1)},${(y + size * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

export function mapPixelSize(cols: number, rows: number): { width: number; height: number } {
  return {
    width: 2 * MARGIN + HEX_SIZE * SQRT3 * (cols + 0.5),
    height: 2 * MARGIN + HEX_SIZE * (1.5 * (rows - 1) + 2),
  };
}

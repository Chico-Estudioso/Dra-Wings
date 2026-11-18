// Pinceles: el trazo se rellena con su color liso (rotulador) o con un patrón de ese color cuya
// transparencia tiene grano (lápiz) o huecos (tiza). El patrón es determinista y se dibuja en el
// espacio del trazo, así que el grano viaja con él y la vista previa coincide con el vídeo.
import type { Ctx2D } from './draw';

export type BrushKind = 'marker' | 'pencil' | 'chalk';

export const BRUSH_LABELS: Record<BrushKind, string> = {
  marker: 'Rotulador',
  pencil: 'Lápiz',
  chalk: 'Tiza',
};

/** Lado de la tesela que se repite (unidades del trazo). */
const TILE = 192;

function hash01(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** Ruido de valor suave y periódico (se repite cada TILE) con celdas de `cell` píxeles (divisor de TILE). */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const period = TILE / cell;
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const wrap = (v: number) => ((v % period) + period) % period;
  const at = (i: number, j: number) => hash01(Math.imul(wrap(i), 73856093) ^ Math.imul(wrap(j), 19349663) ^ seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}

/** Opacidad (0–1) del pincel en el píxel (x, y) de la tesela. */
export function brushAlpha(kind: Exclude<BrushKind, 'marker'>, x: number, y: number): number {
  const fine = hash01(Math.imul(y * TILE + x, 2654435761) ^ 0x51ed27);
  if (kind === 'pencil') {
    // Grafito: grano fino sobre una veta suave, nunca del todo opaco ni del todo vacío.
    const vein = valueNoise(x, y, 6, 0x1234);
    const v = 0.55 * fine + 0.45 * vein;
    return Math.min(1, Math.max(0.18, 0.2 + 0.95 * v));
  }
  // Tiza: casi opaca con huecos irregulares (zonas donde no ha agarrado).
  const blot = valueNoise(x, y, 6, 0x9e37);
  const v = 0.45 * fine + 0.55 * blot;
  return v < 0.34 ? 0.06 : v < 0.43 ? 0.5 : 0.96;
}

/** Componentes de un color `#rrggbb` o `#rrggbbaa`. */
function rgba(color: string): [number, number, number, number] {
  const hex = color.slice(1);
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), hex.length >= 8 ? n(6) / 255 : 1];
}

const cache = new Map<string, CanvasPattern | null>();

function makePattern(ctx: Ctx2D, color: string, kind: Exclude<BrushKind, 'marker'>): CanvasPattern | null {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const tile = new OffscreenCanvas(TILE, TILE);
  const t = tile.getContext('2d');
  if (!t) return null;
  const [r, g, b, a] = rgba(color);
  const img = t.createImageData(TILE, TILE);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const i = (y * TILE + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(255 * a * brushAlpha(kind, x, y));
    }
  t.putImageData(img, 0, 0);
  return ctx.createPattern(tile, 'repeat');
}

/** Relleno de un trazo con el pincel: el color liso o el patrón de ese color con textura. */
export function brushFill(ctx: Ctx2D, color: string, kind: BrushKind | undefined): string | CanvasPattern {
  if (!kind || kind === 'marker') return color;
  const key = `${kind}${color}`;
  let pattern = cache.get(key);
  if (pattern === undefined) {
    if (cache.size >= 64) cache.clear();
    pattern = makePattern(ctx, color, kind);
    cache.set(key, pattern);
  }
  return pattern ?? color;
}

// Tipo de hoja: lisa (el color de fondo), papel con grano, cuaderno de rayas o cuadrícula. Se dibuja
// sobre el fondo y bajo los elementos, dentro de la cámara (la hoja se acerca con lo dibujado).
import type { Ctx2D } from './draw';

export type PaperStyle = 'plain' | 'paper' | 'notebook' | 'grid';

export const PAPER_LABELS: Record<PaperStyle, string> = {
  plain: 'Lisa',
  paper: 'Papel con grano',
  notebook: 'Cuaderno de rayas',
  grid: 'Cuadrícula',
};

/** Número pseudoaleatorio en [0, 1) a partir de un entero (el grano es siempre el mismo). */
function hash01(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

let grain: CanvasPattern | null | undefined;

/** Patrón de grano de papel (una tesela de 256 × 256 que se repite), o null si no hay lienzos. */
function grainPattern(ctx: Ctx2D): CanvasPattern | null {
  if (grain !== undefined) return grain;
  if (typeof OffscreenCanvas === 'undefined') return (grain = null);
  const size = 256;
  const tile = new OffscreenCanvas(size, size);
  const t = tile.getContext('2d');
  if (!t) return (grain = null);
  const img = t.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    // Fibras: manchas claras y oscuras muy suaves.
    const v = hash01(i * 2654435761);
    const dark = v < 0.5;
    img.data[i * 4] = dark ? 90 : 255;
    img.data[i * 4 + 1] = dark ? 80 : 255;
    img.data[i * 4 + 2] = dark ? 60 : 250;
    img.data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * 26);
  }
  t.putImageData(img, 0, 0);
  return (grain = ctx.createPattern(tile, 'repeat'));
}

/** Dibuja el tipo de hoja sobre la hoja (0,0)-(w,h). */
export function drawPaper(ctx: Ctx2D, style: PaperStyle | undefined, w: number, h: number): void {
  if (!style || style === 'plain') return;
  ctx.save();
  if (style === 'paper') {
    const pattern = grainPattern(ctx);
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    const step = h / (style === 'notebook' ? 16 : 20);
    ctx.lineWidth = Math.max(1, h / 900);
    ctx.strokeStyle = 'rgba(47,111,214,0.22)';
    ctx.beginPath();
    for (let y = step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    if (style === 'grid')
      for (let x = step; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
    ctx.stroke();
    if (style === 'notebook') {
      // Margen rojo.
      ctx.strokeStyle = 'rgba(194,59,78,0.4)';
      ctx.lineWidth = Math.max(1.5, h / 600);
      ctx.beginPath();
      ctx.moveTo(w * 0.09, 0);
      ctx.lineTo(w * 0.09, h);
      ctx.stroke();
    }
  }
  ctx.restore();
}

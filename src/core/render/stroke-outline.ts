// Geometría de trazos (pura, sin DOM): entrada para perfect-freehand y contorno resultante.
import { getStroke } from 'perfect-freehand';
import type { Stroke } from '../model/types';
import { POINT_STRIDE } from '../geometry/items';

/** Presión usada cuando el dispositivo no la proporciona (grosor constante; no se simula). */
const NEUTRAL_PRESSURE = 0.5;

function toInput(points: number[], count: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < count * POINT_STRIDE; i += POINT_STRIDE) {
    const p = points[i + 2]!;
    out.push([points[i]!, points[i + 1]!, p < 0 ? NEUTRAL_PRESSURE : p]);
  }
  return out;
}

/** Puntos visibles para un progreso 0..1, interpolando el último (no depende de cuántos eventos hubo). */
export function partialInput(stroke: Stroke, progress: number): number[][] {
  const pts = stroke.points;
  const n = pts.length / POINT_STRIDE;
  if (progress >= 1 || n <= 1) return toInput(pts, n);
  if (progress <= 0) return [];
  const mode = stroke.reveal?.mode ?? 'length';
  // Parámetro acumulado: longitud de arco o tiempo grabado.
  const acc = [0];
  for (let i = 1; i < n; i++) {
    const a = (i - 1) * POINT_STRIDE;
    const b = i * POINT_STRIDE;
    const step =
      mode === 'recorded'
        ? Math.max(0, pts[b + 3]! - pts[a + 3]!)
        : Math.hypot(pts[b]! - pts[a]!, pts[b + 1]! - pts[a + 1]!);
    acc.push(acc[i - 1]! + step);
  }
  const total = acc[n - 1]!;
  if (total === 0) return toInput(pts, n);
  const target = total * progress;
  let i = 1;
  while (i < n - 1 && acc[i]! < target) i++;
  const seg = acc[i]! - acc[i - 1]! || 1;
  const k = Math.min(1, Math.max(0, (target - acc[i - 1]!) / seg));
  const out = toInput(pts, i);
  const a = (i - 1) * POINT_STRIDE;
  const b = i * POINT_STRIDE;
  const pa = pts[a + 2]! < 0 ? NEUTRAL_PRESSURE : pts[a + 2]!;
  const pb = pts[b + 2]! < 0 ? NEUTRAL_PRESSURE : pts[b + 2]!;
  out.push([pts[a]! + (pts[b]! - pts[a]!) * k, pts[a + 1]! + (pts[b + 1]! - pts[a + 1]!) * k, pa + (pb - pa) * k]);
  return out;
}

export function strokeOutline(stroke: Stroke, progress = 1): number[][] {
  const input = partialInput(stroke, progress);
  if (input.length === 0) return [];
  return getStroke(input, {
    size: stroke.style.size,
    thinning: stroke.style.thinning,
    smoothing: stroke.style.smoothing,
    streamline: stroke.style.streamline,
    simulatePressure: false,
    last: progress >= 1,
  });
}

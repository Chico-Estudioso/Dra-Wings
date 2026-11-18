// «Animar arrastrando»: el recorrido que se graba moviendo un elemento mientras avanza el tiempo se
// convierte en keyframes. Se simplifica en (x, y, tiempo) para quedarse con pocos puntos sin perder
// ni la forma ni las pausas.
import type { Ease } from '../model/types';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';

export interface MotionSample {
  t: Ticks;
  x: number;
  y: number;
}

type Key = { t: Ticks; v: number; ease: Ease };

/** Cuántas unidades de la hoja «vale» un segundo al simplificar (equilibra espacio y tiempo). */
const UNITS_PER_SECOND = 300;

function distanceToSegment(p: number[], a: number[], b: number[]): number {
  const ab = a.map((v, i) => b[i]! - v);
  const ap = a.map((v, i) => p[i]! - v);
  const len2 = ab.reduce((s, v) => s + v * v, 0);
  const u = len2 ? Math.max(0, Math.min(1, ap.reduce((s, v, i) => s + v * ab[i]!, 0) / len2)) : 0;
  return Math.hypot(...p.map((v, i) => v - (a[i]! + u * ab[i]!)));
}

/** Ramer–Douglas–Peucker: índices de los puntos que se conservan. */
function simplify(points: number[][], tolerance: number): number[] {
  const keep = new Set([0, points.length - 1]);
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    let worst = -1;
    let dist = tolerance;
    for (let i = from + 1; i < to; i++) {
      const d = distanceToSegment(points[i]!, points[from]!, points[to]!);
      if (d > dist) {
        dist = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep.add(worst);
      stack.push([from, worst], [worst, to]);
    }
  }
  return [...keep].sort((a, b) => a - b);
}

/** Keyframes lineales de x e y que siguen el recorrido grabado (tolerancia en unidades de la hoja). */
export function samplesToKeys(samples: MotionSample[], tolerance = 2): { x: Key[]; y: Key[] } {
  // Orden temporal y una muestra por instante (la última).
  const byTime = new Map<Ticks, MotionSample>();
  for (const s of [...samples].sort((a, b) => a.t - b.t)) byTime.set(s.t, s);
  const list = [...byTime.values()];
  if (list.length === 0) return { x: [], y: [] };
  const points = list.map((s) => [s.x, s.y, (s.t / TICKS_PER_SECOND) * UNITS_PER_SECOND]);
  const kept = list.length <= 2 ? list.map((_, i) => i) : simplify(points, tolerance);
  const pick = (k: 'x' | 'y') => kept.map((i) => ({ t: list[i]!.t, v: list[i]![k], ease: 'linear' as const }));
  return { x: pick('x'), y: pick('y') };
}

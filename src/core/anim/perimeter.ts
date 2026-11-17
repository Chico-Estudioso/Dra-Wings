import type { Shape } from '../model/types';

/** Perímetro aproximado del contorno de una forma (para dibujarla progresivamente). */
export function shapePerimeterOf(s: Shape): number {
  const w = Math.abs(s.w);
  const h = Math.abs(s.h);
  if (s.shape === 'line' || s.shape === 'arrow') return Math.hypot(s.w, s.h);
  if (s.shape === 'rect') return 2 * (w + h);
  if (s.shape === 'ellipse') {
    const a = w / 2;
    const b = h / 2;
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }
  const p = s.points ?? [];
  let len = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    len += Math.hypot(p[j]! - p[i]!, p[j + 1]! - p[i + 1]!);
  }
  return len;
}

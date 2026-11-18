// Dónde está la punta de lo que se está dibujando en un fotograma: ahí se apoya la «mano que
// dibuja». Puro (sin DOM): recibe la lista evaluada y, para textos, una función que mide.
import { apply, type Point } from '../geometry/matrix';
import type { Shape, TextItem } from '../model/types';
import type { RenderItem } from './evaluate';
import { partialInput } from './stroke-outline';

/** Punta (en el espacio local de la forma) de su contorno dibujado hasta `progress`. */
export function shapeTip(s: Shape, progress: number): Point {
  const p = Math.max(0, Math.min(1, progress));
  if (s.shape === 'line' || s.shape === 'arrow') return { x: s.w * p, y: s.h * p };
  const x = Math.min(0, s.w);
  const y = Math.min(0, s.h);
  const w = Math.abs(s.w);
  const h = Math.abs(s.h);
  if (s.shape === 'ellipse') {
    // El contorno de la elipse empieza a la derecha y va en el sentido de las agujas del reloj.
    const a = 2 * Math.PI * p;
    return { x: x + w / 2 + (w / 2) * Math.cos(a), y: y + h / 2 + (h / 2) * Math.sin(a) };
  }
  const pts = s.shape === 'rect' ? [x, y, x + w, y, x + w, y + h, x, y + h] : (s.points ?? []);
  const n = pts.length / 2;
  if (n < 2) return { x, y };
  const seg = (i: number) =>
    Math.hypot(pts[((i + 1) % n) * 2]! - pts[i * 2]!, pts[((i + 1) % n) * 2 + 1]! - pts[i * 2 + 1]!);
  let total = 0;
  for (let i = 0; i < n; i++) total += seg(i);
  let left = total * p;
  for (let i = 0; i < n; i++) {
    const len = seg(i);
    if (left <= len || i === n - 1) {
      const k = len ? Math.min(1, left / len) : 0;
      const j = (i + 1) % n;
      return {
        x: pts[i * 2]! + (pts[j * 2]! - pts[i * 2]!) * k,
        y: pts[i * 2 + 1]! + (pts[j * 2 + 1]! - pts[i * 2 + 1]!) * k,
      };
    }
    left -= len;
  }
  return { x, y };
}

/** Mide hasta dónde llega un texto escrito a medias (espacio local): la da quien dibuja. */
export type TextTip = (t: TextItem, progress: number) => Point | null;

/**
 * Punta de lo que se está dibujando (espacio de la escena), o null si no se dibuja nada. Si hay
 * varias cosas a medias, la de más arriba.
 */
export function drawingTip(list: readonly RenderItem[], textTip?: TextTip): Point | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i]!;
    if (r.progress <= 0 || r.progress >= 1) continue;
    let local: Point | null = null;
    if (r.item.type === 'stroke') {
      const input = partialInput(r.item, r.progress);
      const last = input[input.length - 1];
      if (last) local = { x: last[0]!, y: last[1]! };
    } else if (r.item.type === 'shape') local = shapeTip(r.item, r.progress);
    else if (r.item.type === 'text' && textTip) local = textTip(r.item, r.progress);
    if (local) return apply(r.matrix, local);
  }
  return null;
}

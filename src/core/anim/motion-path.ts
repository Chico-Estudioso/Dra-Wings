// Trayectoria de un elemento animado: el recorrido de su centro entre el primer y el último keyframe
// de posición, para dibujarlo sobre el lienzo.
import { worldBounds } from '../geometry/items';
import type { Point } from '../geometry/matrix';
import type { Item } from '../model/types';
import type { Ticks } from '../time/ticks';
import { valueAt } from './animated';
import { isKeyed } from './keyframes';

export interface MotionPath {
  /** Puntos del recorrido, en orden temporal. */
  points: Point[];
  /** Posición en cada keyframe de posición. */
  keys: Point[];
}

/**
 * Recorrido del centro del elemento (tomado en `around`), muestreado cada `step` ticks (como mucho
 * `max` tramos). Null si la posición no está animada.
 */
export function motionPath(item: Item, around: Ticks, step: Ticks, max = 600): MotionPath | null {
  const { x, y } = item.transform;
  const times = [...new Set([...(isKeyed(x) ? x.keys : []), ...(isKeyed(y) ? y.keys : [])].map((k) => k.t))].sort(
    (a, b) => a - b,
  );
  if (times.length < 2) return null;
  const from = times[0]!;
  const to = times[times.length - 1]!;
  const box = worldBounds(item, around);
  const dx = box.x + box.w / 2 - valueAt(x, around);
  const dy = box.y + box.h / 2 - valueAt(y, around);
  const at = (t: Ticks): Point => ({ x: valueAt(x, t) + dx, y: valueAt(y, t) + dy });
  const n = Math.min(max, Math.max(1, Math.ceil((to - from) / Math.max(1, step))));
  const points = Array.from({ length: n + 1 }, (_, i) => at(from + ((to - from) * i) / n));
  return { points, keys: times.map(at) };
}

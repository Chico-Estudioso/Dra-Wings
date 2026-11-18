// Repetir movimiento: al acabar sus keyframes, la animación de un elemento puede repetirse o ir y
// volver mientras sigue en pantalla. Se traduce el instante al de dentro del ciclo; las apariciones
// y desapariciones usan el tiempo real.
import type { AnimatedNumber, Item } from '../model/types';
import type { Ticks } from '../time/ticks';

export type LoopKind = NonNullable<Item['loop']>;

export const LOOP_LABELS: Record<LoopKind | 'none', string> = {
  none: 'Se queda quieto',
  repeat: 'Se repite',
  pingpong: 'Va y vuelve',
};

const spans = new WeakMap<object, { from: Ticks; to: Ticks } | null>();

/** Primer y último keyframe del elemento (posición, escala, giro y opacidad). */
function keySpan(item: Item): { from: Ticks; to: Ticks } | null {
  if (spans.has(item)) return spans.get(item)!;
  let from = Infinity;
  let to = -Infinity;
  const add = (a: AnimatedNumber) => {
    if (!('keys' in a)) return;
    for (const k of a.keys) {
      from = Math.min(from, k.t);
      to = Math.max(to, k.t);
    }
  };
  const t = item.transform;
  [t.x, t.y, t.scaleX, t.scaleY, t.rotation, item.opacity].forEach(add);
  const span = to > from ? { from, to } : null;
  spans.set(item, span);
  return span;
}

/** Instante con el que se evalúan los keyframes del elemento en `tick`. */
export function loopTime(item: Item, tick: Ticks): Ticks {
  if (!item.loop) return tick;
  const span = keySpan(item);
  if (!span || tick <= span.to) return tick;
  const period = span.to - span.from;
  const phase = (tick - span.from) % (item.loop === 'pingpong' ? 2 * period : period);
  return span.from + (phase <= period ? phase : 2 * period - phase);
}

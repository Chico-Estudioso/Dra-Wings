// Edición de keyframes sobre valores animables.
import type { AnimatedNumber, Ease, Item, Transform } from '../model/types';
import type { Ticks } from '../time/ticks';
import { valueAt } from './animated';

export const DEFAULT_EASE: Ease = 'easeInOut';

export const ANIMATABLE = ['x', 'y', 'scaleX', 'scaleY', 'rotation'] as const;
export type AnimatableProp = (typeof ANIMATABLE)[number];

export const isKeyed = (a: AnimatedNumber): a is Extract<AnimatedNumber, { keys: unknown }> => 'keys' in a;

/**
 * Fija `value` en el instante `t`.
 * - Si ya está animado: crea o actualiza el keyframe de `t`.
 * - Si es constante y `record` es cierto con `t` posterior a `from`: crea la animación desde `from`.
 * - En otro caso: cambia el valor constante.
 */
export function setValueAt(a: AnimatedNumber, t: Ticks, value: number, record: boolean, from: Ticks): AnimatedNumber {
  if (isKeyed(a)) {
    const keys = a.keys.filter((k) => k.t !== t);
    const prev = a.keys.find((k) => k.t === t);
    keys.push({ t, v: value, ease: prev?.ease ?? DEFAULT_EASE });
    keys.sort((p, q) => p.t - q.t);
    return { keys };
  }
  if (record && t > from && value !== a.value) {
    return {
      keys: [
        { t: from, v: a.value, ease: DEFAULT_EASE },
        { t, v: value, ease: DEFAULT_EASE },
      ],
    };
  }
  return { value };
}

/** Quita el keyframe de `t`; si queda uno solo, vuelve a ser constante. */
export function removeKeyAt(a: AnimatedNumber, t: Ticks): AnimatedNumber {
  if (!isKeyed(a)) return a;
  const keys = a.keys.filter((k) => k.t !== t);
  if (keys.length === a.keys.length) return a;
  if (keys.length === 0) return { value: valueAt(a, t) };
  if (keys.length === 1) return { value: keys[0]!.v };
  return { keys };
}

export function shiftKeys(a: AnimatedNumber, dt: Ticks): AnimatedNumber {
  return isKeyed(a) ? { keys: a.keys.map((k) => ({ ...k, t: Math.max(0, k.t + dt) })) } : a;
}

/** Instantes con keyframe de un elemento (transformación y opacidad), ordenados. */
export function keyTimes(item: Item): Ticks[] {
  const set = new Set<Ticks>();
  const add = (a: AnimatedNumber) => isKeyed(a) && a.keys.forEach((k) => set.add(k.t));
  for (const p of ANIMATABLE) add(item.transform[p]);
  add(item.opacity);
  return [...set].sort((a, b) => a - b);
}

export function transformKeyTimes(t: Transform): Ticks[] {
  const set = new Set<Ticks>();
  for (const p of ANIMATABLE) {
    const a = t[p];
    if (isKeyed(a)) a.keys.forEach((k) => set.add(k.t));
  }
  return [...set].sort((a, b) => a - b);
}

/** Desplaza en el tiempo todo lo que define cuándo aparece un elemento: entrada, salida y keyframes. */
export function shiftItemTime(item: Item, dt: Ticks): void {
  item.in = Math.max(0, item.in + dt);
  if (item.out !== undefined) item.out = Math.max(item.in + 1, item.out + dt);
  for (const p of ANIMATABLE) item.transform[p] = shiftKeys(item.transform[p], dt);
  item.opacity = shiftKeys(item.opacity, dt);
}

/** Convierte las propiedades animadas en constantes con el valor del instante `t`. */
export function clearAnimation(item: Item, t: Ticks): void {
  for (const p of ANIMATABLE) item.transform[p] = { value: valueAt(item.transform[p], t) };
  item.opacity = { value: valueAt(item.opacity, t) };
}

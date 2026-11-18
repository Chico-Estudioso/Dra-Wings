// Valores animables: constantes o con keyframes (ver docs/ANIMATION_ENGINE.md).
import type { AnimatedNumber } from '../model/types';
import type { Ticks } from '../time/ticks';

import type { Ease } from '../model/types';

/** Rebote al llegar (como una pelota que cae). */
function bounceOut(u: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (u < 1 / d) return n * u * u;
  if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75;
  if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375;
  return n * (u -= 2.625 / d) * u + 0.984375;
}

/** Curvas de suavizado entre dos keyframes: 0 → 1 (las de impulso se pasan un poco y vuelven). */
export const EASE: Record<Ease, (u: number) => number> = {
  linear: (u) => u,
  easeIn: (u) => u * u * u,
  easeOut: (u) => 1 - (1 - u) ** 3,
  easeInOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  hold: () => 0,
  back: (u) => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2,
  bounce: bounceOut,
};

export const fixed = (value: number): AnimatedNumber => ({ value });

/** Valor en el instante `t`. Antes del primer keyframe vale el primero; después del último, el último. */
export function valueAt(a: AnimatedNumber, t: Ticks): number {
  if ('value' in a) return a.value;
  const keys = a.keys;
  const first = keys[0]!;
  if (t <= first.t) return first.v;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t < k.t) {
      const prev = keys[i - 1]!;
      const u = (t - prev.t) / (k.t - prev.t);
      return prev.v + (k.v - prev.v) * EASE[prev.ease](u);
    }
  }
  return keys[keys.length - 1]!.v;
}

/** Suma `delta` al valor (o a todos sus keyframes, para desplazar una animación entera). */
export function offset(a: AnimatedNumber, delta: number): AnimatedNumber {
  if ('value' in a) return { value: a.value + delta };
  return { keys: a.keys.map((k) => ({ ...k, v: k.v + delta })) };
}

/** Fija un valor constante. Con keyframes, en M2 sustituye la animación (la edición por keyframes llega en M4). */
export function setValue(_a: AnimatedNumber, value: number): AnimatedNumber {
  return { value };
}

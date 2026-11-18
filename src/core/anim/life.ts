// Vida automática: un movimiento de reposo sutil y continuo (respirar, balancearse, flotar, latir)
// que se calcula al dibujar, sin keyframes. Cada elemento tiene su propio desfase (según su id) para
// que no se muevan todos a la vez. Es determinista: la vista previa y el vídeo coinciden.
import { localBounds } from '../geometry/items';
import { IDENTITY, multiply, rotateDeg, scale, translate, type Mat } from '../geometry/matrix';
import type { Item } from '../model/types';
import { seedOf } from '../render/boil';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';

export type LifeKind = 'breathe' | 'sway' | 'float' | 'pulse' | 'beat-pulse' | 'beat-bounce' | 'beat-sway';

export const LIFE_LABELS: Record<LifeKind, string> = {
  breathe: 'Respirar',
  sway: 'Balancearse',
  float: 'Flotar',
  pulse: 'Latir',
  'beat-pulse': 'Latir al ritmo',
  'beat-bounce': 'Saltar al ritmo',
  'beat-sway': 'Balancearse al ritmo',
};

/** Tipos que siguen los golpes de la música. */
export const isBeatLife = (kind: LifeKind) => kind.startsWith('beat-');

/** Sin ritmo detectado, los tipos «al ritmo» siguen un pulso de 120 BPM. */
const FALLBACK_BEAT = TICKS_PER_SECOND / 2;

export const LIFE_AMOUNTS = { soft: 0.5, normal: 1, strong: 1.7 } as const;
export const LIFE_AMOUNT_LABELS: Record<keyof typeof LIFE_AMOUNTS, string> = {
  soft: 'Suave',
  normal: 'Normal',
  strong: 'Marcado',
};

/** Duración de un ciclo (segundos). */
const PERIOD = { breathe: 3.2, sway: 4, float: 3, pulse: 1 } as const;

/** Golpe anterior (índice) y fracción hasta el siguiente para `tick`; null fuera de los golpes. */
function beatSpan(tick: Ticks, beats: readonly Ticks[] | undefined) {
  if (!beats?.length) {
    const i = Math.floor(tick / FALLBACK_BEAT);
    return { i, u: (tick - i * FALLBACK_BEAT) / FALLBACK_BEAT };
  }
  if (tick < beats[0]! || tick >= beats[beats.length - 1]!) return null;
  let lo = 0;
  let hi = beats.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (beats[mid]! <= tick) lo = mid;
    else hi = mid;
  }
  return { i: lo, u: (tick - beats[lo]!) / (beats[lo + 1]! - beats[lo]!) };
}

const boxes = new WeakMap<object, { x: number; y: number; w: number; h: number }>();
const boxOf = (item: Item) => {
  let b = boxes.get(item);
  if (!b) boxes.set(item, (b = localBounds(item)));
  return b;
};

/** Transforma alrededor del punto (px, py) del espacio local del elemento. */
const around = (px: number, py: number, m: Mat): Mat => multiply(multiply(translate(px, py), m), translate(-px, -py));

/**
 * Matriz de vida del elemento en `tick` (en su espacio local; se aplica después de su transformación).
 * Respirar y balancearse pivotan en la base (los pies no se despegan del suelo).
 */
export function lifeMatrix(item: Item, tick: Ticks, beats?: readonly Ticks[]): Mat {
  const life = item.life;
  if (!life || life.amount <= 0) return IDENTITY;
  const k = life.amount;
  const b = boxOf(item);
  const cx = b.x + b.w / 2;
  const bottom = b.y + b.h;
  const kind = life.kind;
  if (kind === 'beat-pulse' || kind === 'beat-bounce' || kind === 'beat-sway') {
    const span = beatSpan(tick, beats);
    if (!span) return IDENTITY;
    const { i, u } = span;
    if (kind === 'beat-pulse') {
      // Golpe seco en el tiempo y vuelta suave.
      const e = Math.exp(-u * 6);
      return around(cx, b.y + b.h / 2, scale(1 + 0.08 * k * e, 1 + 0.08 * k * e));
    }
    if (kind === 'beat-bounce') {
      // Aterriza en cada golpe (se aplasta un poco) y sube entre golpes.
      const squash = Math.exp(-u * 10);
      const hop = translate(0, -0.06 * k * b.h * Math.sin(Math.PI * u));
      return multiply(hop, around(cx, bottom, scale(1 + 0.05 * k * squash, 1 - 0.07 * k * squash)));
    }
    // De un lado al otro en cada golpe.
    const ease = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    return around(cx, bottom, rotateDeg(3 * k * Math.cos(Math.PI * (i + ease))));
  }
  const phase = ((seedOf(item.id) % 1000) / 1000) * Math.PI * 2;
  const s = Math.sin((2 * Math.PI * tick) / TICKS_PER_SECOND / PERIOD[kind] + phase);
  switch (kind) {
    case 'breathe':
      return around(cx, bottom, scale(1 - 0.006 * k * s, 1 + 0.018 * k * s));
    case 'sway':
      return around(cx, bottom, rotateDeg(1.6 * k * s));
    case 'float': {
      const tilt = Math.cos((2 * Math.PI * tick) / TICKS_PER_SECOND / PERIOD.float + phase);
      return multiply(translate(0, -0.035 * k * b.h * s), around(cx, b.y + b.h / 2, rotateDeg(0.8 * k * tilt)));
    }
    case 'pulse': {
      // Latido: sube rápido y baja despacio.
      const beat = Math.max(0, s) ** 3;
      return around(cx, b.y + b.h / 2, scale(1 + 0.05 * k * beat, 1 + 0.05 * k * beat));
    }
  }
}

// Vida automática: un movimiento de reposo sutil y continuo (respirar, balancearse, flotar, latir)
// que se calcula al dibujar, sin keyframes. Cada elemento tiene su propio desfase (según su id) para
// que no se muevan todos a la vez. Es determinista: la vista previa y el vídeo coinciden.
import { localBounds } from '../geometry/items';
import { IDENTITY, multiply, rotateDeg, scale, translate, type Mat } from '../geometry/matrix';
import type { Item } from '../model/types';
import { seedOf } from '../render/boil';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';

export type LifeKind = 'breathe' | 'sway' | 'float' | 'pulse';

export const LIFE_LABELS: Record<LifeKind, string> = {
  breathe: 'Respirar',
  sway: 'Balancearse',
  float: 'Flotar',
  pulse: 'Latir',
};

export const LIFE_AMOUNTS = { soft: 0.5, normal: 1, strong: 1.7 } as const;
export const LIFE_AMOUNT_LABELS: Record<keyof typeof LIFE_AMOUNTS, string> = {
  soft: 'Suave',
  normal: 'Normal',
  strong: 'Marcado',
};

/** Duración de un ciclo (segundos). */
const PERIOD: Record<LifeKind, number> = { breathe: 3.2, sway: 4, float: 3, pulse: 1 };

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
export function lifeMatrix(item: Item, tick: Ticks): Mat {
  const life = item.life;
  if (!life || life.amount <= 0) return IDENTITY;
  const k = life.amount;
  const phase = ((seedOf(item.id) % 1000) / 1000) * Math.PI * 2;
  const s = Math.sin((2 * Math.PI * tick) / TICKS_PER_SECOND / PERIOD[life.kind] + phase);
  const b = boxOf(item);
  const cx = b.x + b.w / 2;
  const bottom = b.y + b.h;
  switch (life.kind) {
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

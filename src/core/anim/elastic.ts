// Elasticidad: lo que se mueve deprisa se estira en la dirección del movimiento (y se estrecha de
// lado, algo menos de lo que se alarga), y vuelve a su forma al frenar. Opcionalmente deja estela. Se calcula
// a partir de la velocidad del elemento, sin keyframes, y es determinista.
import { valueAt } from './animated';
import { loopTime } from './loop';
import { multiply, rotateDeg, scale, translate, type Mat } from '../geometry/matrix';
import type { Item } from '../model/types';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';

export type ElasticLevel = 'off' | 'soft' | 'medium' | 'strong';

export const ELASTIC_LABELS: Record<ElasticLevel, string> = {
  off: 'Rígido',
  soft: 'Suave',
  medium: 'Normal',
  strong: 'Marcado',
};

const AMOUNT: Record<ElasticLevel, number> = { off: 0, soft: 0.5, medium: 1, strong: 1.6 };

/** Intervalo para medir la velocidad (1/60 s). */
const DT = TICKS_PER_SECOND / 60;
/** Velocidad (unidades de una hoja de 1920 de ancho por segundo) a partir de la que se nota. */
const MIN_SPEED = 40;

export const elasticAmount = (level: ElasticLevel | undefined) => AMOUNT[level ?? 'off'];

/** Velocidad del elemento en `tick` (unidades de escena por segundo). */
export function velocity(item: Item, tick: Ticks): { vx: number; vy: number } {
  const { x, y } = item.transform;
  const t0 = Math.max(0, tick - DT);
  const dt = (tick - t0) / TICKS_PER_SECOND;
  if (dt <= 0) return { vx: 0, vy: 0 };
  const a = loopTime(item, t0);
  const b = loopTime(item, tick);
  return { vx: (valueAt(x, b) - valueAt(x, a)) / dt, vy: (valueAt(y, b) - valueAt(y, a)) / dt };
}

/**
 * Estiramiento en el espacio del padre, alrededor del ancla del elemento en ese espacio (`cx`, `cy`).
 * `unit` pasa las velocidades a una hoja de 1920 de ancho (la misma sensación en cualquier formato).
 */
export function stretchMatrix(
  item: Item,
  tick: Ticks,
  amount: number,
  cx: number,
  cy: number,
  unit: number,
): Mat | null {
  if (amount <= 0) return null;
  const { vx, vy } = velocity(item, tick);
  const speed = Math.hypot(vx, vy) / unit;
  if (speed < MIN_SPEED) return null;
  const k = 1 + Math.min(0.45, 0.3 * amount * (1 - Math.exp(-speed / 1500)));
  const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
  // T(c) · R(θ) · S(k, 1/√k) · R(-θ) · T(-c)
  return multiply(
    multiply(multiply(translate(cx, cy), rotateDeg(deg)), scale(k, 1 / Math.sqrt(k))),
    multiply(rotateDeg(-deg), translate(-cx, -cy)),
  );
}

/** Instantes y opacidades de la estela (de la más lejana a la más cercana). */
export const TRAIL: readonly { dt: Ticks; alpha: number }[] = [
  { dt: (3 * TICKS_PER_SECOND) / 30, alpha: 0.1 },
  { dt: (2 * TICKS_PER_SECOND) / 30, alpha: 0.18 },
  { dt: TICKS_PER_SECOND / 30, alpha: 0.3 },
];

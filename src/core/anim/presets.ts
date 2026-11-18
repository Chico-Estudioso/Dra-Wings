// Animaciones rápidas: crean keyframes normales (editables después) en el instante dado, partiendo de
// cómo está el elemento en ese instante. Sirven para quien no quiere animar a mano y como punto de
// partida para quien sí.
import { worldBounds } from '../geometry/items';
import type { AnimatedNumber, Ease, Item } from '../model/types';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';
import { valueAt } from './animated';
import { isKeyed, type AnimatableProp } from './keyframes';

export type Direction = 'left' | 'right' | 'up' | 'down';
export type PresetId = 'enter' | 'exit' | 'jump' | 'sway' | 'pulse' | 'float' | 'spin' | 'shake' | 'grow';

export const PRESET_LABELS: Record<PresetId, string> = {
  enter: 'Entrar',
  exit: 'Salir',
  jump: 'Saltar',
  sway: 'Balancearse',
  pulse: 'Latir',
  float: 'Flotar',
  spin: 'Girar',
  shake: 'Temblar',
  grow: 'Crecer',
};

export const EASE_LABELS: Record<Ease, string> = {
  easeInOut: 'Suave',
  linear: 'Constante',
  easeIn: 'Acelerar',
  easeOut: 'Frenar',
  back: 'Con impulso',
  bounce: 'Rebote',
  hold: 'A saltos',
};

type Key = { t: Ticks; v: number; ease: Ease };
const S = TICKS_PER_SECOND;
const sec = (s: number) => Math.round(s * S);

/**
 * Pone los keyframes dados en una propiedad: sustituye los que hubiera en ese tramo y conserva los de
 * fuera. Una propiedad constante pasa a animada.
 */
export function mergeKeys(a: AnimatedNumber, keys: Key[]): AnimatedNumber {
  if (!keys.length) return a;
  const from = keys[0]!.t;
  const to = keys[keys.length - 1]!.t;
  const kept = isKeyed(a) ? a.keys.filter((k) => k.t < from || k.t > to) : [];
  const all = [...kept, ...keys].sort((p, q) => p.t - q.t);
  return all.length === 1 ? { value: all[0]!.v } : { keys: all };
}

/** Keyframes relativos al valor de la propiedad en `t`: `[segundos, delta, suavizado del tramo]`. */
function relative(item: Item, prop: AnimatableProp, t: Ticks, steps: [number, number, Ease][]): void {
  const base = valueAt(item.transform[prop], t);
  item.transform[prop] = mergeKeys(
    item.transform[prop],
    steps.map(([s, d, ease]) => ({ t: t + sec(s), v: base + d, ease })),
  );
}

export interface PresetOptions {
  /** Hoja (para saber cuánto hay que desplazar para entrar o salir de ella). */
  page: { width: number; height: number };
  direction?: Direction;
}

/** Duración de cada animación rápida (segundos). */
export const PRESET_SECONDS: Record<PresetId, number> = {
  enter: 0.8,
  exit: 0.8,
  jump: 0.6,
  sway: 1.6,
  pulse: 1,
  float: 2.4,
  spin: 1,
  shake: 0.5,
  grow: 0.6,
};

/**
 * Aplica una animación rápida al elemento a partir de `t` (si `t` es anterior a su aparición, desde
 * que aparece). Devuelve el instante en que termina.
 */
export function applyPreset(item: Item, preset: PresetId, t0: Ticks, opts: PresetOptions): Ticks {
  const t = Math.max(t0, item.in);
  const dur = PRESET_SECONDS[preset];
  const box = worldBounds(item, t);
  const dir = opts.direction ?? 'left';
  const margin = 20;
  // Distancia para quedar justo fuera de la hoja por el lado indicado.
  const away = {
    left: { prop: 'x' as const, d: -(box.x + box.w + margin) },
    right: { prop: 'x' as const, d: opts.page.width - box.x + margin },
    up: { prop: 'y' as const, d: -(box.y + box.h + margin) },
    down: { prop: 'y' as const, d: opts.page.height - box.y + margin },
  }[dir];

  switch (preset) {
    case 'enter':
      // Llega desde fuera de la hoja y frena con un pequeño impulso.
      relative(item, away.prop, t, [
        [0, away.d, 'back'],
        [dur, 0, 'easeInOut'],
      ]);
      break;
    case 'exit':
      relative(item, away.prop, t, [
        [0, 0, 'easeIn'],
        [dur, away.d, 'easeInOut'],
      ]);
      item.out = t + sec(dur);
      item.exit = undefined;
      break;
    case 'jump': {
      const h = Math.max(30, box.h * 0.35);
      relative(item, 'y', t, [
        [0, 0, 'easeOut'],
        [dur / 2, -h, 'easeIn'],
        [dur, 0, 'easeInOut'],
      ]);
      // Se aplasta un poco al aterrizar.
      relative(item, 'scaleY', t, [
        [dur * 0.85, 0, 'easeOut'],
        [dur * 0.92, -0.12, 'easeOut'],
        [dur * 1.1, 0, 'easeInOut'],
      ]);
      break;
    }
    case 'sway':
      relative(item, 'rotation', t, [
        [0, 0, 'easeInOut'],
        [dur * 0.25, 8, 'easeInOut'],
        [dur * 0.75, -8, 'easeInOut'],
        [dur, 0, 'easeInOut'],
      ]);
      break;
    case 'pulse':
      for (const prop of ['scaleX', 'scaleY'] as const)
        relative(item, prop, t, [
          [0, 0, 'easeOut'],
          [dur * 0.25, 0.15, 'easeIn'],
          [dur * 0.5, 0, 'easeOut'],
          [dur * 0.75, 0.15, 'easeIn'],
          [dur, 0, 'easeInOut'],
        ]);
      break;
    case 'float': {
      const h = Math.max(12, box.h * 0.06);
      relative(item, 'y', t, [
        [0, 0, 'easeInOut'],
        [dur * 0.25, -h, 'easeInOut'],
        [dur * 0.5, 0, 'easeInOut'],
        [dur * 0.75, -h, 'easeInOut'],
        [dur, 0, 'easeInOut'],
      ]);
      break;
    }
    case 'spin':
      relative(item, 'rotation', t, [
        [0, 0, 'easeInOut'],
        [dur, 360, 'easeInOut'],
      ]);
      break;
    case 'shake': {
      const d = Math.max(6, box.w * 0.03);
      relative(item, 'x', t, [
        [0, 0, 'linear'],
        [dur * 0.125, -d, 'linear'],
        [dur * 0.375, d, 'linear'],
        [dur * 0.625, -d, 'linear'],
        [dur * 0.875, d, 'linear'],
        [dur, 0, 'easeInOut'],
      ]);
      break;
    }
    case 'grow':
      for (const prop of ['scaleX', 'scaleY'] as const) {
        const base = valueAt(item.transform[prop], t);
        item.transform[prop] = mergeKeys(item.transform[prop], [
          { t, v: base * 0.2, ease: 'back' },
          { t: t + sec(dur), v: base, ease: 'easeInOut' },
        ]);
      }
      break;
  }
  return t + sec(dur);
}

/** Cambia el suavizado de todos los tramos animados del elemento. */
export function setItemEase(item: Item, ease: Ease): void {
  const apply = (a: AnimatedNumber): AnimatedNumber => (isKeyed(a) ? { keys: a.keys.map((k) => ({ ...k, ease })) } : a);
  for (const p of ['x', 'y', 'scaleX', 'scaleY', 'rotation'] as const) item.transform[p] = apply(item.transform[p]);
  item.opacity = apply(item.opacity);
}

/** Suavizado común de los tramos del elemento (null si no tiene o si mezcla varios). */
export function itemEase(item: Item): Ease | null {
  const eases = new Set<Ease>();
  for (const a of [
    ...(['x', 'y', 'scaleX', 'scaleY', 'rotation'] as const).map((p) => item.transform[p]),
    item.opacity,
  ])
    if (isKeyed(a)) a.keys.slice(0, -1).forEach((k) => eases.add(k.ease));
  return eases.size === 1 ? [...eases][0]! : null;
}

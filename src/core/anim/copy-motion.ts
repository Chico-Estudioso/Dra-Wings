// Copiar y pegar animación: el movimiento de un elemento se aplica a otros, cada uno desde donde
// está y desde que aparece. Las claves se guardan relativas: desplazamiento en posición y giro,
// factor en escala y valor en opacidad; el tiempo, desde la aparición del elemento.
import type { AnimatedNumber, Ease, Enter, Exit, Item } from '../model/types';
import type { Ticks } from '../time/ticks';
import { valueAt } from './animated';

type TransformProp = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY';
type Prop = TransformProp | 'opacity';
const TRANSFORM_PROPS: TransformProp[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY'];

interface RelKey {
  /** Desde la aparición del elemento. */
  dt: Ticks;
  v: number;
  ease: Ease;
}

export interface CopiedMotion {
  keys: Partial<Record<Prop, RelKey[]>>;
  enter?: Enter;
  exit?: Exit;
  /** Cuánto dura en pantalla (si desaparece). */
  stay?: Ticks;
  loop?: Item['loop'];
  life?: Item['life'];
  trail?: boolean;
}

const isScale = (p: Prop) => p === 'scaleX' || p === 'scaleY';

function animatedOf(item: Item, p: Prop): AnimatedNumber {
  return p === 'opacity' ? item.opacity : item.transform[p];
}

function setAnimated(item: Item, p: Prop, a: AnimatedNumber): void {
  if (p === 'opacity') item.opacity = a;
  else item.transform[p] = a;
}

/** Animación de un elemento lista para pegar en otros. */
export function copyMotion(item: Item): CopiedMotion {
  const keys: CopiedMotion['keys'] = {};
  for (const p of [...TRANSFORM_PROPS, 'opacity'] as Prop[]) {
    const a = animatedOf(item, p);
    if (!('keys' in a)) continue;
    const base = a.keys[0]!.v;
    keys[p] = a.keys.map((k) => ({
      dt: k.t - item.in,
      v: p === 'opacity' ? k.v : isScale(p) ? (base ? k.v / base : 1) : k.v - base,
      ease: k.ease,
    }));
  }
  const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
  return {
    keys,
    enter: clone(item.enter),
    exit: clone(item.exit),
    stay: item.out !== undefined ? item.out - item.in : undefined,
    loop: item.loop,
    life: clone(item.life),
    trail: item.trail,
  };
}

/** ¿Hay algo que pegar además de la aparición? */
export function hasMotion(m: CopiedMotion): boolean {
  return Object.keys(m.keys).length > 0 || !!m.life || !!m.loop || !!m.trail || m.stay !== undefined;
}

/**
 * Pega la animación en `item`: sus keyframes (los que tuviera en esas propiedades se sustituyen)
 * parten de su valor actual al aparecer, y aparición, salida, repetición, vida y estela pasan tal cual
 * (salvo la duración de «Dibujarse», que depende de cada dibujo).
 */
export function pasteMotion(item: Item, m: CopiedMotion): void {
  for (const p of [...TRANSFORM_PROPS, 'opacity'] as Prop[]) {
    const rel = m.keys[p];
    const current = animatedOf(item, p);
    if (!rel) {
      // Sin animación en la copia: esta propiedad se queda quieta donde está ahora.
      if ('keys' in current) setAnimated(item, p, { value: valueAt(current, item.in) });
      continue;
    }
    const base = valueAt(current, item.in);
    const out: { t: Ticks; v: number; ease: Ease }[] = [];
    for (const k of rel) {
      const t = Math.max(0, item.in + k.dt);
      const v = p === 'opacity' ? k.v : isScale(p) ? base * k.v : base + k.v;
      // Claves que caerían antes del principio de la escena se juntan en la primera.
      if (out.length && t <= out[out.length - 1]!.t)
        out[out.length - 1] = { t: out[out.length - 1]!.t, v, ease: k.ease };
      else out.push({ t, v, ease: k.ease });
    }
    setAnimated(item, p, { keys: out });
  }
  // «Dibujarse» dura según lo largo del dibujo: si los dos se dibujan, el destino conserva su duración.
  if (m.enter && !(m.enter.kind === 'draw' && item.enter?.kind === 'draw')) item.enter = { ...m.enter };
  if (m.stay !== undefined) {
    item.out = item.in + m.stay;
    if (m.exit) item.exit = { ...m.exit };
    else delete item.exit;
  } else {
    delete item.out;
    delete item.exit;
  }
  if (m.loop) item.loop = m.loop;
  else delete item.loop;
  if (m.life) item.life = { ...m.life };
  else delete item.life;
  if (m.trail) item.trail = true;
  else delete item.trail;
}

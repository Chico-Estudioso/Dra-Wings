// Lo que hace un elemento, contado como una lista de pasos en el tiempo («aparece dibujándose», «se
// mueve», «salta», «cambia a risa», «siempre respira», «desaparece»). Es una lectura de los datos que
// ya tiene el elemento (aparición, keyframes, cambios de aspecto, vida, salida…), no un formato nuevo:
// se puede animar con cualquier herramienta y la lista lo refleja. Cada paso se puede quitar.
import { EXPRESSIONS, POSES, type Expression, type Pose } from '../library/character';
import { removeSwap } from '../edit/group';
import type { AnimatedNumber, Item } from '../model/types';
import type { Ticks } from '../time/ticks';
import { valueAt } from './animated';
import { DEFAULT_EASE, isKeyed } from './keyframes';
import { LIFE_LABELS } from './life';

export type StepKind = 'enter' | 'motion' | 'look' | 'exit' | 'life' | 'loop' | 'trail' | 'talk';

export interface Step {
  /** Identificador estable (para la lista y para quitarlo). */
  key: string;
  kind: StepKind;
  /** Cuándo empieza, o null si es continuo («siempre»). */
  t: Ticks | null;
  /** Cuándo termina (si dura). */
  end?: Ticks;
  label: string;
}

type Prop = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity';
const PROPS: Prop[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];
const EPS = 1e-6;

const get = (item: Item, p: Prop): AnimatedNumber => (p === 'opacity' ? item.opacity : item.transform[p]);
const put = (item: Item, p: Prop, a: AnimatedNumber) => {
  if (p === 'opacity') item.opacity = a;
  else item.transform[p] = a;
};

/** Tramos de movimiento: intervalos entre keyframes en los que algo cambia, unidos si se tocan. */
export function motionSpans(item: Item): { start: Ticks; end: Ticks; props: Set<Prop> }[] {
  const times = new Set<Ticks>();
  for (const p of PROPS) {
    const a = get(item, p);
    if (isKeyed(a)) a.keys.forEach((k) => times.add(k.t));
  }
  const sorted = [...times].sort((a, b) => a - b);
  const spans: { start: Ticks; end: Ticks; props: Set<Prop> }[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const changed = PROPS.filter((p) => {
      const an = get(item, p);
      return isKeyed(an) && Math.abs(valueAt(an, a) - valueAt(an, b)) > EPS;
    });
    if (!changed.length) continue;
    const last = spans[spans.length - 1];
    if (last && last.end === a) {
      last.end = b;
      changed.forEach((p) => last.props.add(p));
    } else spans.push({ start: a, end: b, props: new Set(changed) });
  }
  return spans;
}

/** Nombre del tramo según lo que cambia y si termina como empezó. */
function motionLabel(item: Item, start: Ticks, end: Ticks, props: Set<Prop>): string {
  const back = [...props].every((p) => Math.abs(valueAt(get(item, p), start) - valueAt(get(item, p), end)) < 1e-3);
  const moves = props.has('x') || props.has('y');
  const turns = props.has('rotation');
  const sizes = props.has('scaleX') || props.has('scaleY');
  const fades = props.has('opacity');
  if (back) {
    if (moves && sizes && !turns) return 'Salta';
    if (moves && !sizes && !turns) return 'Se mueve y vuelve';
    if (turns && !moves && !sizes) return 'Se balancea';
    if (sizes && !moves && !turns) return 'Late';
    if (fades && props.size === 1) return 'Parpadea';
  }
  const parts: string[] = [];
  if (moves) parts.push('se mueve');
  if (turns) parts.push('gira');
  if (sizes) parts.push('cambia de tamaño');
  if (fades) parts.push(valueAt(item.opacity, end) < valueAt(item.opacity, start) ? 'se desvanece' : 'se hace visible');
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]!;
  return text.charAt(0).toUpperCase() + text.slice(1) + (back ? ' y vuelve' : '');
}

/** «risa, brazos arriba» a partir de la variante de un cambio de aspecto («personaje/expresión/postura»). */
export function lookLabel(variant: string | undefined): string {
  const [, expression, pose] = (variant ?? '').split('/');
  const e = EXPRESSIONS[expression as Expression];
  const p = POSES[pose as Pose];
  return e && p ? `${e}, ${p.toLowerCase()}` : 'otro aspecto';
}

function enterLabel(item: Item): string {
  const e = item.enter;
  if (!e || e.kind === 'none') return 'Aparece (sin animación)';
  if (e.kind === 'fade') return 'Aparece con un fundido';
  if (e.kind === 'pop') return 'Aparece de golpe';
  if (item.type === 'text') return 'Se escribe';
  if (item.type === 'image') return 'Aparece';
  return 'Se dibuja';
}

/** Pasos del elemento, en orden: primero los que pasan en un momento y luego los continuos. */
export function itemSteps(item: Item): Step[] {
  const steps: Step[] = [];
  steps.push({
    key: 'enter',
    kind: 'enter',
    t: item.in,
    end: item.in + (item.enter && item.enter.kind !== 'none' ? item.enter.duration : 0),
    label: enterLabel(item),
  });
  for (const s of motionSpans(item))
    steps.push({
      key: `motion:${s.start}`,
      kind: 'motion',
      t: s.start,
      end: s.end,
      label: motionLabel(item, s.start, s.end, s.props),
    });
  if (item.type === 'group')
    for (const sw of item.swaps ?? [])
      steps.push({ key: `look:${sw.t}`, kind: 'look', t: sw.t, label: `Cambia a ${lookLabel(sw.variant)}` });
  if (item.out !== undefined) {
    const d = item.exit && item.exit.kind !== 'none' ? item.exit.duration : 0;
    const label =
      item.exit?.kind === 'fade'
        ? 'Desaparece con un fundido'
        : item.exit?.kind === 'pop'
          ? 'Desaparece encogiéndose'
          : 'Desaparece';
    steps.push({ key: 'exit', kind: 'exit', t: Math.max(item.in, item.out - d), end: item.out, label });
  }
  steps.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  if (item.type === 'group' && item.talk)
    steps.push({ key: 'talk', kind: 'talk', t: null, label: 'Habla con la narración' });
  if (item.life) steps.push({ key: 'life', kind: 'life', t: null, label: LIFE_LABELS[item.life.kind] });
  if (item.loop)
    steps.push({
      key: 'loop',
      kind: 'loop',
      t: null,
      label: item.loop === 'pingpong' ? 'Repite su movimiento yendo y volviendo' : 'Repite su movimiento',
    });
  if (item.trail) steps.push({ key: 'trail', kind: 'trail', t: null, label: 'Deja estela al moverse' });
  return steps;
}

/**
 * Quita un tramo de movimiento: sus keyframes desaparecen y lo que venga después sigue igual pero
 * desde donde se queda el elemento (desplazamiento y giro se restan, la escala se divide).
 */
function removeSpan(item: Item, start: Ticks, end: Ticks): void {
  for (const p of PROPS) {
    const a = get(item, p);
    if (!isKeyed(a)) continue;
    const va = valueAt(a, start);
    const vb = valueAt(a, end);
    const keys = a.keys
      .filter((k) => !(k.t > start && k.t <= end))
      .map((k) => {
        if (k.t <= end || p === 'opacity') return k;
        if (p === 'scaleX' || p === 'scaleY') return { ...k, v: vb ? (k.v * va) / vb : k.v };
        return { ...k, v: k.v - (vb - va) };
      });
    put(item, p, keys.length > 1 ? { keys } : { value: keys[0]?.v ?? va });
  }
}

/** Quita un paso del elemento. */
export function removeStep(item: Item, step: Step): void {
  switch (step.kind) {
    case 'enter':
      item.enter = { kind: 'none', duration: 0 };
      return;
    case 'motion':
      if (step.t !== null && step.end !== undefined) removeSpan(item, step.t, step.end);
      return;
    case 'look':
      if (item.type === 'group' && step.t !== null) removeSwap(item, step.t);
      return;
    case 'exit':
      delete item.out;
      delete item.exit;
      return;
    case 'life':
      delete item.life;
      return;
    case 'loop':
      delete item.loop;
      return;
    case 'trail':
      delete item.trail;
      return;
    case 'talk':
      if (item.type === 'group') delete item.talk;
      return;
  }
}

/**
 * «De aquí a allí»: el valor va desde el que tiene en `t0` hasta `value` en `t1`, sustituyendo lo que
 * hubiera entre medias. Lo de después de `t1` se queda como estaba.
 */
export function moveBetween(a: AnimatedNumber, t0: Ticks, t1: Ticks, value: number): AnimatedNumber {
  const v0 = valueAt(a, t0);
  if (!isKeyed(a)) {
    if (Math.abs(value - v0) < EPS) return a;
    return {
      keys: [
        { t: t0, v: v0, ease: DEFAULT_EASE },
        { t: t1, v: value, ease: DEFAULT_EASE },
      ],
    };
  }
  const keys = a.keys.filter((k) => k.t < t0 || k.t > t1);
  keys.push({ t: t0, v: v0, ease: a.keys.find((k) => k.t === t0)?.ease ?? DEFAULT_EASE });
  keys.push({ t: t1, v: value, ease: DEFAULT_EASE });
  keys.sort((p, q) => p.t - q.t);
  return { keys };
}

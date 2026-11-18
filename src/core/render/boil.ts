// «Trazo vivo» (line boil): en la animación dibujada a mano el mismo dibujo se calca varias veces y
// se alternan las copias, así que las líneas tiemblan un poco aunque nada se mueva. Aquí se imita de
// forma determinista: cada elemento tiene unas pocas variantes ligeramente deformadas (según su id)
// que se alternan a ritmo fijo. La vista previa y la exportación usan las mismas funciones.
import type { Mat } from '../geometry/matrix';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';

export type BoilLevel = 'off' | 'soft' | 'medium' | 'strong';

export const BOIL_LABELS: Record<BoilLevel, string> = {
  off: 'Quieto',
  soft: 'Suave',
  medium: 'Normal',
  strong: 'Marcado',
};

const AMOUNT: Record<BoilLevel, number> = { off: 0, soft: 0.55, medium: 1, strong: 1.7 };

/** Cambios de dibujo por segundo (como animar «a tres» a 24 fps). */
export const BOIL_RATE = 8;
/** Variantes que se alternan en ciclo. */
export const BOIL_VARIANTS = 3;

export interface Boil {
  variant: number;
  amount: number;
}

/**
 * Variante del instante `tick` para un proyecto a `fps`. Cambia cada número entero de fotogramas
 * (24 fps: cada 3; 30 fps: cada 4) para que el ritmo sea regular en el vídeo. Null si está quieto.
 */
export function boilAt(level: BoilLevel | undefined, tick: Ticks, fps: number): Boil | null {
  const amount = AMOUNT[level ?? 'off'];
  if (!amount) return null;
  const frame = Math.floor((tick * fps) / TICKS_PER_SECOND + 1e-9);
  const step = Math.max(1, Math.round(fps / BOIL_RATE));
  return { variant: Math.floor(frame / step) % BOIL_VARIANTS, amount };
}

/** Semilla estable a partir de un texto (FNV-1a). */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Número pseudoaleatorio en [0, 1) a partir de un entero. */
function hash01(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** Ruido suave en [-1, 1] a lo largo de `x`. */
function noise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(seed ^ Math.imul(i, 0x9e3779b1)) * 2 - 1;
  const b = hash01(seed ^ Math.imul(i + 1, 0x9e3779b1)) * 2 - 1;
  return a + (b - a) * u;
}

const variantSeed = (seed: number, variant: number) => (seed + Math.imul(variant + 1, 0x632be5ab)) >>> 0;

/** Amplitud del temblor de un trazo (unidades locales): crece con el grosor, con tope. */
export const strokeBoilAmp = (size: number, amount: number) => Math.min(2.5, 0.6 + size * 0.12) * amount;

/**
 * Desplaza los puntos de entrada de un trazo (`[x, y, presión]`) con un ruido suave a lo largo de su
 * longitud: la línea ondula un poco sin romperse. La misma longitud recorrida da el mismo
 * desplazamiento, así que un trazo a medio dibujar coincide con el completo.
 */
export function wobblePoints(input: number[][], seed: number, variant: number, amp: number, wave: number) {
  const sx = variantSeed(seed, variant);
  const sy = (sx ^ 0x5bd1e995) >>> 0;
  let s = 0;
  return input.map((p, i) => {
    if (i) s += Math.hypot(p[0]! - input[i - 1]![0]!, p[1]! - input[i - 1]![1]!);
    const k = s / wave;
    return [p[0]! + amp * noise(sx, k), p[1]! + amp * noise(sy, k), p[2]!];
  });
}

/**
 * Pequeño desplazamiento y giro (en coordenadas locales de un elemento de `w` × `h`) para formas y
 * textos: sus bordes se mueven unas `amp` unidades.
 */
export function jitterMatrix(seed: number, variant: number, w: number, h: number, amp: number): Mat {
  const s = variantSeed(seed, variant);
  const r = (k: number) => hash01((s + k * 0x27d4eb2d) >>> 0) * 2 - 1;
  const dx = amp * r(1);
  const dy = amp * r(2);
  const a = (amp * r(3)) / Math.max(Math.abs(w), Math.abs(h), 1);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cx = w / 2;
  const cy = h / 2;
  // T(c + d) · R(a) · T(-c)
  return [cos, sin, -sin, cos, cx + dx - cos * cx + sin * cy, cy + dy - sin * cx - cos * cy];
}

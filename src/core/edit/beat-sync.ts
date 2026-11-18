// Sincronía con el ritmo: instantes de los golpes (o de los compases) de una escena, con un pulso
// de 120 BPM cuando no hay música con ritmo detectado.
import type { Beat } from '../audio/rhythm';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';

const S = TICKS_PER_SECOND;
/** Pulso sin música: 120 BPM, compases de 4. */
export const FALLBACK_BEAT = S / 2;

/** Golpes (locales) de la escena, o el pulso de 120 BPM si no hay. */
export function beatsOrPulse(beats: readonly Beat[], duration: Ticks): Beat[] {
  if (beats.length) return [...beats];
  const out: Beat[] = [];
  for (let i = 0, t = 0; t < duration; i++, t += FALLBACK_BEAT) out.push({ t, bar: i % 4 === 0 });
  return out;
}

/**
 * `n` instantes a partir de `from` (incluido), uno por golpe o por compás. Si no hay bastantes, se
 * sigue con el mismo intervalo que los últimos.
 */
export function staggerTimes(beats: readonly Beat[], from: Ticks, n: number, bars: boolean): Ticks[] {
  const grid = beats.filter((b) => (bars ? b.bar : true)).map((b) => b.t);
  const out = grid.filter((t) => t >= from).slice(0, n);
  const step =
    grid.length >= 2 ? grid[grid.length - 1]! - grid[grid.length - 2]! : bars ? 4 * FALLBACK_BEAT : FALLBACK_BEAT;
  while (out.length < n) out.push(out.length ? out[out.length - 1]! + step : Math.max(from, 0));
  return out;
}

/** Duración que termina en el inicio de compás más cercano al final actual (al menos un compás). */
export function barAlignedDuration(beats: readonly Beat[], duration: Ticks): Ticks {
  const bars = beats.filter((b) => b.bar && b.t > 0).map((b) => b.t);
  if (!bars.length) return duration;
  let best = bars[0]!;
  for (const t of bars) if (Math.abs(t - duration) < Math.abs(best - duration)) best = t;
  // Más allá del último compás conocido, se sigue contando compases del mismo largo.
  const last = bars[bars.length - 1]!;
  if (duration > last && bars.length >= 2) {
    const bar = last - bars[bars.length - 2]!;
    const extra = Math.round((duration - last) / bar);
    best = last + extra * bar;
  }
  return best;
}

/** Zoom de la cámara que late al empezar cada compás (1 = sin zoom). */
export function barPulse(beats: readonly Beat[], local: Ticks): number {
  let last: Ticks | null = null;
  for (const b of beats) {
    if (b.t > local) break;
    if (b.bar) last = b.t;
  }
  if (last === null) return 1;
  return 1 + 0.04 * Math.exp((-(local - last) / S) * 6);
}

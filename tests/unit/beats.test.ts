import { describe, expect, it } from 'vitest';
import { detectBeats } from '@core/audio/beats';

const RATE = 44_100;

/** Ruido determinista. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
}

/**
 * Pista de prueba: bombo en cada golpe (más fuerte al empezar compás), caja en 2 y 4, charles en los
 * contratiempos y un poco de ruido de fondo. Devuelve las muestras y los instantes reales.
 */
function song(bpm: number, seconds: number, opts: { start?: number; seed?: number; swing?: number } = {}) {
  const n = Math.round(seconds * RATE);
  const x = new Float32Array(n);
  const r = rng(opts.seed ?? 1);
  for (let i = 0; i < n; i++) x[i] = r() * 0.02;
  const period = 60 / bpm;
  const beats: number[] = [];
  const hit = (t: number, f: number, decay: number, gain: number, noisy = false) => {
    const s0 = Math.round(t * RATE);
    for (let i = 0; i < RATE * 0.25 && s0 + i < n; i++) {
      const e = Math.exp(-i / (decay * RATE));
      x[s0 + i] = x[s0 + i]! + gain * e * (noisy ? r() * 2 : Math.sin((2 * Math.PI * f * i) / RATE));
    }
  };
  for (let k = 0, t = opts.start ?? 0.5; t < seconds - 0.3; k++, t += period) {
    beats.push(t);
    hit(t, 60, 0.08, k % 4 === 0 ? 0.9 : 0.6);
    if (k % 2 === 1) hit(t, 0, 0.05, 0.35, true);
    hit(t + period / 2 + (opts.swing ?? 0), 0, 0.015, 0.12, true);
  }
  return { x, beats };
}

describe('detección de golpes', () => {
  for (const bpm of [92, 120, 128, 150]) {
    it(`encuentra el tempo y los golpes de una canción a ${bpm} BPM`, () => {
      const { x, beats } = song(bpm, 20, { seed: bpm });
      const r = detectBeats(x, RATE)!;
      expect(Math.abs(r.bpm - bpm)).toBeLessThan(1.5);
      // Casi todos los golpes reales tienen uno detectado a menos de 50 ms.
      const near = beats.filter((t) => r.beats.some((b) => Math.abs(b - t) < 0.05)).length;
      expect(near / beats.length).toBeGreaterThan(0.9);
      expect(r.beats.length).toBeLessThan(beats.length * 1.1);
    });
  }

  it('el compás empieza en el golpe más fuerte', () => {
    const { x, beats } = song(120, 16, { start: 0.5 });
    const r = detectBeats(x, RATE)!;
    const first = r.beats[r.downbeat]!;
    const index = beats.findIndex((t) => Math.abs(t - first) < 0.06);
    expect(index % 4).toBe(0);
  });

  it('el silencio o un audio muy corto no tienen ritmo', () => {
    expect(detectBeats(new Float32Array(RATE * 10), RATE)).toBeNull();
    expect(detectBeats(song(120, 2).x, RATE)).toBeNull();
  });

  it('funciona igual a 48 kHz', () => {
    const { x } = song(110, 15);
    // Remuestreo burdo a 48 kHz (interpolación lineal).
    const n = Math.round((x.length * 48_000) / RATE);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = (i * RATE) / 48_000;
      const a = Math.floor(p);
      y[i] = x[a]! + (x[Math.min(a + 1, x.length - 1)]! - x[a]!) * (p - a);
    }
    expect(Math.abs(detectBeats(y, 48_000)!.bpm - 110)).toBeLessThan(1.5);
  });
});

import { describe, expect, it } from 'vitest';
import { barAlignedDuration, barPulse, beatsOrPulse, staggerTimes } from '@core/edit/beat-sync';
import type { Beat } from '@core/audio/rhythm';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
/** Golpes cada 0,6 s desde 0,3 s; compás cada 4 empezando en el primero. */
const song: Beat[] = Array.from({ length: 12 }, (_, i) => ({ t: 0.3 * S + i * 0.6 * S, bar: i % 4 === 0 }));

describe('sincronía con el ritmo', () => {
  it('sin música, un pulso de 120 BPM con compases de 4', () => {
    const p = beatsOrPulse([], 3 * S);
    expect(p.map((b) => b.t / S)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    expect(p.filter((b) => b.bar).map((b) => b.t / S)).toEqual([0, 2]);
    expect(beatsOrPulse(song, 3 * S)).toEqual(song);
  });

  it('escalona desde el cabezal, por golpes o por compases, y sigue el ritmo si faltan', () => {
    expect(staggerTimes(song, S, 3, false).map((t) => +(t / S).toFixed(2))).toEqual([1.5, 2.1, 2.7]);
    expect(staggerTimes(song, 0, 3, true).map((t) => +(t / S).toFixed(2))).toEqual([0.3, 2.7, 5.1]);
    // Más elementos que golpes: se sigue con el mismo intervalo.
    const many = staggerTimes(song, 6 * S, 3, false).map((t) => +(t / S).toFixed(2));
    expect(many).toEqual([6.3, 6.9, 7.5]);
  });

  it('el final de la escena cae en el compás más cercano', () => {
    expect(barAlignedDuration(song, 2.5 * S) / S).toBeCloseTo(2.7);
    expect(barAlignedDuration(song, 5.5 * S) / S).toBeCloseTo(5.1);
    // Más allá del último compás, compases del mismo largo.
    expect(barAlignedDuration(song, 9.6 * S) / S).toBeCloseTo(9.9);
    expect(barAlignedDuration([], 4 * S)).toBe(4 * S);
  });

  it('la cámara late al empezar cada compás y se calma enseguida', () => {
    expect(barPulse(song, 0.2 * S)).toBe(1);
    expect(barPulse(song, 0.3 * S)).toBeCloseTo(1.04);
    expect(barPulse(song, 0.6 * S)).toBeLessThan(1.04);
    expect(barPulse(song, 2 * S)).toBeLessThan(1.001);
    expect(barPulse(song, 2.7 * S)).toBeCloseTo(1.04);
  });
});

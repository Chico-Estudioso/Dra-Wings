import { describe, expect, it } from 'vitest';
import { SFX_LABELS, SFX_RATE, synthSfx, type SfxId } from '@core/audio/sfx';
import { encodeWav } from '@core/audio/wav';

const ids = Object.keys(SFX_LABELS) as SfxId[];

describe('efectos de sonido', () => {
  it('todos suenan, sin pasarse de volumen ni chasquear en los extremos', () => {
    for (const id of ids) {
      const x = synthSfx(id);
      expect(x.length).toBeGreaterThan(0.04 * SFX_RATE);
      expect(x.length).toBeLessThan(2.5 * SFX_RATE);
      let peak = 0;
      let energy = 0;
      for (const v of x) {
        peak = Math.max(peak, Math.abs(v));
        energy += v * v;
      }
      // Normalizado a 0,8 (un poco menos si el pico cae en los fundidos de los extremos).
      expect(peak).toBeLessThanOrEqual(0.8 + 1e-6);
      expect(peak).toBeGreaterThan(0.5);
      expect(energy / x.length).toBeGreaterThan(1e-4);
      expect(Math.abs(x[0]!)).toBeLessThan(0.01);
      expect(Math.abs(x[x.length - 1]!)).toBeLessThan(0.01);
    }
  });

  it('son deterministas (el mismo archivo cada vez) y distintos entre sí', () => {
    const wavs = ids.map((id) => encodeWav(synthSfx(id), SFX_RATE));
    expect(encodeWav(synthSfx('pop'), SFX_RATE)).toEqual(wavs[0]);
    const keys = new Set(wavs.map((w) => `${w.length}:${w.slice(1000, 1200).join(',')}`));
    expect(keys.size).toBe(ids.length);
  });
});

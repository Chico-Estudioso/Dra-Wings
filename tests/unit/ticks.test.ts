import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_FPS,
  TICKS_PER_SECOND,
  formatTimecode,
  frameAt,
  snapToFrame,
  ticksFromFrame,
  ticksFromSeconds,
  ticksPerFrame,
} from '@core/time/ticks';

describe('ticks', () => {
  it('cada FPS soportado tiene un número entero de ticks por fotograma', () => {
    for (const fps of SUPPORTED_FPS) expect(Number.isInteger(ticksPerFrame(fps))).toBe(true);
  });

  it('las frecuencias de audio habituales dividen exactamente un segundo', () => {
    for (const rate of [8000, 16000, 22050, 24000, 32000, 44100, 48000, 88200, 96000, 192000])
      expect(Number.isInteger(TICKS_PER_SECOND / rate)).toBe(true);
  });

  it('fotograma ↔ ticks es exacto y frameAt cae en el fotograma correcto en los bordes', () => {
    for (const fps of SUPPORTED_FPS) {
      for (const f of [0, 1, 2, 3, 29, 30, 31, 1799, 108_000]) {
        const t = ticksFromFrame(f, fps);
        expect(frameAt(t, fps)).toBe(f);
        expect(frameAt(t - 1, fps)).toBe(f - 1);
      }
    }
    // A 30 fps, el fotograma 3 empieza exactamente en 0,1 s.
    expect(ticksFromFrame(3, 30)).toBe(ticksFromSeconds(0.1));
  });

  it('snapToFrame redondea al fotograma más cercano', () => {
    const tpf = ticksPerFrame(30);
    expect(snapToFrame(tpf * 2 + tpf / 2 - 1, 30)).toBe(tpf * 2);
    expect(snapToFrame(tpf * 2 + tpf / 2 + 1, 30)).toBe(tpf * 3);
  });

  it('formatea códigos de tiempo', () => {
    expect(formatTimecode(0, 30)).toBe('00:00:00');
    expect(formatTimecode(ticksFromFrame(30 * 65 + 7, 30), 30)).toBe('01:05:07');
    expect(formatTimecode(ticksFromSeconds(3600 + 2), 25)).toBe('1:00:02:00');
  });
});

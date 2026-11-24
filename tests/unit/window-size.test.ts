import { describe, expect, it } from 'vitest';
import { windowSizeFor } from '../../src/main/window-size';

describe('tamaño de la ventana según la pantalla', () => {
  it('en un portátil con escala (1366 × 768 al 125 %) cabe entera y se maximiza', () => {
    const r = windowSizeFor({ width: 1093, height: 574 });
    expect(r.size).toEqual({ width: 1093, height: 574 });
    expect(r.min.width).toBeLessThanOrEqual(1093);
    expect(r.min.height).toBeLessThanOrEqual(574);
    expect(r.maximize).toBe(true);
  });

  it('en una pantalla grande se abre a un tamaño cómodo, sin maximizar', () => {
    expect(windowSizeFor({ width: 2560, height: 1400 })).toEqual({
      size: { width: 1440, height: 900 },
      min: { width: 800, height: 520 },
      maximize: false,
    });
  });

  it('el mínimo nunca es mayor que la pantalla', () => {
    const r = windowSizeFor({ width: 700, height: 480 });
    expect(r.min).toEqual({ width: 700, height: 480 });
  });
});

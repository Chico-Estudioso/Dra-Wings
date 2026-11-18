import { describe, expect, it } from 'vitest';
import { brushAlpha, brushFill } from '@core/render/brush';
import { createStroke } from '@core/model/factory';
import { createProject } from '@core/model/factory';
import { validateProject } from '@core/model/validate';
import type { Ctx2D } from '@core/render/draw';

const TILE = 192;

function stats(kind: 'pencil' | 'chalk') {
  let sum = 0;
  let holes = 0;
  let min = 1;
  let max = 0;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const a = brushAlpha(kind, x, y);
      sum += a;
      if (a < 0.2) holes++;
      min = Math.min(min, a);
      max = Math.max(max, a);
    }
  return { mean: sum / (TILE * TILE), holes: holes / (TILE * TILE), min, max };
}

describe('pinceles', () => {
  it('el lápiz tiene grano: nunca vacío ni del todo uniforme', () => {
    const s = stats('pencil');
    expect(s.min).toBeGreaterThanOrEqual(0.18);
    expect(s.max).toBeLessThanOrEqual(1);
    expect(s.mean).toBeGreaterThan(0.55);
    expect(s.mean).toBeLessThan(0.85);
  });

  it('la tiza tiene huecos, pero la mayor parte agarra', () => {
    const s = stats('chalk');
    expect(s.holes).toBeGreaterThan(0.05);
    expect(s.holes).toBeLessThan(0.35);
    expect(s.mean).toBeGreaterThan(0.6);
  });

  it('es determinista (la vista previa y el vídeo coinciden)', () => {
    for (const [x, y] of [
      [0, 0],
      [17, 101],
      [191, 191],
    ])
      expect(brushAlpha('chalk', x!, y!)).toBe(brushAlpha('chalk', x!, y!));
  });

  it('el rotulador es el color liso, y sin lienzos se usa el color', () => {
    const ctx = {} as Ctx2D;
    expect(brushFill(ctx, '#123456', undefined)).toBe('#123456');
    expect(brushFill(ctx, '#123456', 'marker')).toBe('#123456');
    // En Node no hay OffscreenCanvas: el lápiz cae al color liso en vez de fallar.
    expect(brushFill(ctx, '#123456', 'pencil')).toBe('#123456');
  });

  it('el pincel se guarda en el trazo (sin campo para el rotulador)', () => {
    const style = { color: '#000000', size: 8, opacity: 1 };
    expect(createStroke([0, 0, -1, 0, 10, 10, -1, 50], { ...style, brush: 'marker' }).style.brush).toBeUndefined();
    const s = createStroke([0, 0, -1, 0, 10, 10, -1, 50], { ...style, brush: 'chalk' });
    expect(s.style.brush).toBe('chalk');
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    p.scenes[0]!.layers[0]!.items!.push(s);
    expect(validateProject(p).ok).toBe(true);
  });
});

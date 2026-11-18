import { describe, expect, it } from 'vitest';
import { drawPaper, type PaperStyle } from '@core/render/paper';
import type { Ctx2D } from '@core/render/draw';
import { createProject } from '@core/model/factory';
import { validateProject } from '@core/model/validate';

/** Contexto falso que cuenta líneas y rellenos. */
function fakeCtx() {
  const calls = { moveTo: 0, fillRect: 0, stroke: 0 };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      if (prop in calls) return () => calls[prop as keyof typeof calls]++;
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  }) as unknown as Ctx2D;
  return { ctx, calls };
}

describe('tipo de hoja', () => {
  const draw = (style: PaperStyle | undefined) => {
    const f = fakeCtx();
    drawPaper(f.ctx, style, 1920, 1080);
    return f.calls;
  };

  it('lisa no dibuja nada; rayas y cuadrícula dibujan sus líneas', () => {
    expect(draw(undefined)).toEqual({ moveTo: 0, fillRect: 0, stroke: 0 });
    expect(draw('plain').moveTo).toBe(0);
    // Cuaderno: 15 rayas y el margen.
    expect(draw('notebook')).toMatchObject({ moveTo: 16, stroke: 2 });
    // Cuadrícula: 19 horizontales y 35 verticales (celdas de 54).
    expect(draw('grid').moveTo).toBe(19 + 35);
  });

  it('el papel con grano no falla sin lienzos (en Node) y el ajuste se guarda', () => {
    expect(() => draw('paper')).not.toThrow();
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    p.settings.paper = 'notebook';
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});

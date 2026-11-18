import { describe, expect, it } from 'vitest';
import { drawingTip, shapeTip } from '@core/render/hand-tip';
import { createShape, createStroke } from '@core/model/factory';
import { translate } from '@core/geometry/matrix';
import type { RenderItem } from '@core/render/evaluate';

const style = { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 };

describe('punta de lo que se dibuja', () => {
  it('líneas, rectángulos, elipses y polígonos', () => {
    expect(shapeTip(createShape('line', 0, 0, 100, 50, style), 0.5)).toEqual({ x: 50, y: 25 });
    // Rectángulo 100 × 50 (perímetro 300): a 1/2 está en la esquina inferior derecha.
    const rect = createShape('rect', 0, 0, 100, 50, style);
    expect(shapeTip(rect, 0.5)).toEqual({ x: 100, y: 50 });
    expect(shapeTip(rect, 1 / 6)).toEqual({ x: 50, y: 0 });
    // Elipse: empieza a la derecha y baja.
    const e = createShape('ellipse', 0, 0, 100, 60, style);
    const q = shapeTip(e, 0.25);
    expect(q.x).toBeCloseTo(50);
    expect(q.y).toBeCloseTo(60);
  });

  it('la punta es la del elemento de más arriba que se está dibujando, en la escena', () => {
    const stroke = createStroke([0, 0, -1, 0, 100, 0, -1, 10], { color: '#000000', size: 4, opacity: 1 });
    const shape = createShape('line', 0, 0, 100, 0, style);
    const list: RenderItem[] = [
      { item: shape, matrix: translate(0, 500), opacity: 1, progress: 0.3, fill: 1 },
      { item: stroke, matrix: translate(10, 20), opacity: 1, progress: 0.5, fill: 1 },
      { item: createShape('rect', 0, 0, 10, 10, style), matrix: translate(0, 0), opacity: 1, progress: 1, fill: 1 },
    ];
    expect(drawingTip(list)).toEqual({ x: 60, y: 20 });
    // Sin nada a medias, no hay mano.
    expect(drawingTip(list.map((r) => ({ ...r, progress: 1 })))).toBeNull();
    // Un texto solo tiene punta si se sabe medir.
    expect(drawingTip([{ ...list[0]!, progress: 1 }])).toBeNull();
  });
});

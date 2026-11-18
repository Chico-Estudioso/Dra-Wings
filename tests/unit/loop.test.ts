import { describe, expect, it } from 'vitest';
import { loopTime } from '@core/anim/loop';
import { itemMatrix } from '@core/geometry/items';
import { createProject, createShape } from '@core/model/factory';
import { evaluateScene } from '@core/render/evaluate';
import { validateProject } from '@core/model/validate';
import type { Item } from '@core/model/types';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
/** Va de x=0 (1 s) a x=100 (2 s). */
function swing(loop?: Item['loop']): Item {
  const r = createShape('rect', 0, 0, 50, 50, { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 });
  r.transform.x = {
    keys: [
      { t: S, v: 0, ease: 'linear' },
      { t: 2 * S, v: 100, ease: 'linear' },
    ],
  };
  r.loop = loop;
  return r;
}
const xAt = (item: Item, t: number) => itemMatrix(item, t)[4];

describe('repetir movimiento', () => {
  it('sin bucle se queda en el último keyframe', () => {
    const item = swing();
    expect(loopTime(item, 3.5 * S)).toBe(3.5 * S);
    expect(xAt(item, 3.5 * S)).toBeCloseTo(100);
  });

  it('se repite: después del último keyframe vuelve a empezar', () => {
    const item = swing('repeat');
    expect(loopTime(item, 1.5 * S)).toBe(1.5 * S);
    expect(xAt(item, 2.5 * S)).toBeCloseTo(50);
    expect(xAt(item, 3.25 * S)).toBeCloseTo(25);
    // Antes del primer keyframe no cambia nada.
    expect(loopTime(item, 0.5 * S)).toBe(0.5 * S);
  });

  it('va y vuelve: tras llegar al final, regresa', () => {
    const item = swing('pingpong');
    expect(xAt(item, 2.25 * S)).toBeCloseTo(75);
    expect(xAt(item, 3 * S)).toBeCloseTo(0);
    expect(xAt(item, 3.5 * S)).toBeCloseTo(50);
  });

  it('el render y el toque usan el ciclo; sin keyframes no hay bucle', () => {
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    const item = swing('repeat');
    p.scenes[0]!.layers[0]!.items!.push(item);
    const at = (t: number) => evaluateScene(p.scenes[0]!, t, { mode: 'edit' })[0]!.matrix[4];
    expect(at(2.5 * S)).toBeCloseTo(at(1.5 * S));
    const still = createShape('rect', 0, 0, 50, 50, { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 });
    still.loop = 'repeat';
    expect(loopTime(still, 5 * S)).toBe(5 * S);
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});

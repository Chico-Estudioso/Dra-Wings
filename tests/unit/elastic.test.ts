import { describe, expect, it } from 'vitest';
import { stretchMatrix, velocity } from '@core/anim/elastic';
import { apply, matrixFrom, resolveTransform } from '@core/geometry/matrix';
import { createProject, createShape } from '@core/model/factory';
import { evaluateScene } from '@core/render/evaluate';
import { validateProject } from '@core/model/validate';
import type { Item } from '@core/model/types';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
/** Rectángulo de 100 × 100 que cruza de x=0 a x=`dist` entre 1 s y 2 s. */
function mover(dist = 1200): Item {
  const r = createShape('rect', 0, 0, 100, 100, { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 });
  r.transform.x = {
    keys: [
      { t: S, v: 0, ease: 'linear' },
      { t: 2 * S, v: dist, ease: 'linear' },
    ],
  };
  return r;
}

describe('elasticidad', () => {
  it('mide la velocidad del elemento', () => {
    const { vx, vy } = velocity(mover(), 1.5 * S);
    expect(vx).toBeCloseTo(1200, 0);
    expect(vy).toBe(0);
    expect(velocity(mover(), 0.5 * S).vx).toBe(0);
  });

  it('deprisa se estira en la dirección del movimiento sin moverse de su sitio', () => {
    const item = mover();
    const t = resolveTransform(item.transform, 1.5 * S);
    const cx = t.x + t.anchorX;
    const cy = t.y + t.anchorY;
    const m = stretchMatrix(item, 1.5 * S, 1, cx, cy, 1)!;
    // El ancla no se mueve.
    const c = apply(m, { x: cx, y: cy });
    expect(c.x).toBeCloseTo(cx, 9);
    expect(c.y).toBeCloseTo(cy, 9);
    // Más ancho en x y más estrecho en y (k por 1/√k).
    const right = apply(m, { x: cx + 50, y: cy });
    const top = apply(m, { x: cx, y: cy - 50 });
    const sx = (right.x - cx) / 50;
    const sy = (cy - top.y) / 50;
    expect(sx).toBeGreaterThan(1.1);
    expect(sy).toBeLessThan(1);
    expect(sx * sy * sy).toBeCloseTo(1, 6);
    // Más rápido, más estirado; con tope.
    const fast = stretchMatrix(mover(20_000), 1.5 * S, 1.6, cx, cy, 1)!;
    expect((apply(fast, { x: cx + 50, y: cy }).x - cx) / 50).toBeLessThanOrEqual(1.45 + 1e-9);
    expect((apply(fast, { x: cx + 50, y: cy }).x - cx) / 50).toBeGreaterThan(sx);
  });

  it('quieto, lento o rígido no cambia', () => {
    expect(stretchMatrix(mover(), 0.5 * S, 1, 0, 0, 1)).toBeNull();
    expect(stretchMatrix(mover(20), 1.5 * S, 1, 0, 0, 1)).toBeNull();
    expect(stretchMatrix(mover(), 1.5 * S, 0, 0, 0, 1)).toBeNull();
  });

  it('al reproducir se aplica, con estela opcional; al editar no', () => {
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    const item = mover();
    p.scenes[0]!.layers[0]!.items!.push(item);
    const scene = p.scenes[0]!;
    const plain = matrixFrom(resolveTransform(item.transform, 1.5 * S));
    expect(evaluateScene(scene, 1.5 * S, { mode: 'edit', elastic: 1 })[0]!.matrix).toEqual(plain);
    expect(evaluateScene(scene, 1.5 * S, { mode: 'play', elastic: 1 })[0]!.matrix).not.toEqual(plain);
    expect(evaluateScene(scene, 1.5 * S, { mode: 'play', elastic: 0 })[0]!.matrix).toEqual(plain);
    item.trail = true;
    const list = evaluateScene(scene, 1.5 * S, { mode: 'play' });
    expect(list).toHaveLength(4);
    expect(list.slice(0, 3).every((r) => r.opacity < 0.5)).toBe(true);
    expect(evaluateScene(scene, 0.5 * S, { mode: 'play' })).toHaveLength(1);
    expect(p.settings.elastic).toBe('medium');
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});

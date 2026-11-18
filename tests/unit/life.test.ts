import { describe, expect, it } from 'vitest';
import { lifeMatrix } from '@core/anim/life';
import { apply, IDENTITY } from '@core/geometry/matrix';
import { createProject, createShape } from '@core/model/factory';
import { buildCharacter, DEFAULT_CHARACTER } from '@core/library/character';
import { evaluateScene } from '@core/render/evaluate';
import { validateProject } from '@core/model/validate';
import type { Item } from '@core/model/types';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const box = (life?: Item['life']) => {
  const r = createShape('rect', 0, 0, 100, 200, { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 });
  r.life = life;
  return r;
};
const times = Array.from({ length: 40 }, (_, i) => (i * S) / 10);

describe('vida automática', () => {
  it('sin vida no hay movimiento', () => {
    expect(lifeMatrix(box(), S)).toBe(IDENTITY);
    expect(lifeMatrix(box({ kind: 'sway', amount: 0 }), S)).toBe(IDENTITY);
  });

  it('respirar y balancearse dejan los pies en el suelo y se mueven poco', () => {
    for (const kind of ['breathe', 'sway'] as const) {
      const item = box({ kind, amount: 1 });
      const feet = { x: 50, y: 202 }; // centro de la base (incluye medio grosor del borde)
      let moved = 0;
      for (const t of times) {
        const m = lifeMatrix(item, t);
        const f = apply(m, feet);
        expect(Math.hypot(f.x - feet.x, f.y - feet.y)).toBeLessThan(1e-9);
        const head = apply(m, { x: 50, y: -2 });
        const d = Math.hypot(head.x - 50, head.y + 2);
        expect(d).toBeLessThan(8);
        moved = Math.max(moved, d);
      }
      expect(moved).toBeGreaterThan(2);
    }
  });

  it('flotar sube y baja, latir crece desde el centro, y la intensidad se nota', () => {
    const float = box({ kind: 'float', amount: 1 });
    const ys = times.map((t) => apply(lifeMatrix(float, t), { x: 50, y: 100 }).y - 100);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(8);
    const pulse = box({ kind: 'pulse', amount: 1 });
    for (const t of times) {
      const c = apply(lifeMatrix(pulse, t), { x: 50, y: 100 });
      expect(Math.hypot(c.x - 50, c.y - 100)).toBeLessThan(1e-9);
    }
    const strong = box({ kind: 'float', amount: 1.7 });
    const ys2 = times.map((t) => apply(lifeMatrix(strong, t), { x: 50, y: 100 }).y - 100);
    expect(Math.max(...ys2) - Math.min(...ys2)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
  });

  it('cada elemento tiene su desfase y el resultado es reproducible', () => {
    const a = box({ kind: 'sway', amount: 1 });
    const b = box({ kind: 'sway', amount: 1 });
    expect(lifeMatrix(a, S)).toEqual(lifeMatrix(a, S));
    expect(lifeMatrix(a, S)).not.toEqual(lifeMatrix(b, S));
  });

  it('solo se aplica al reproducir y en el vídeo; los personajes respiran por defecto', () => {
    const character = buildCharacter(DEFAULT_CHARACTER);
    expect(character.life).toEqual({ kind: 'breathe', amount: 1 });
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    const item = box({ kind: 'float', amount: 1 });
    p.scenes[0]!.layers[0]!.items!.push(item);
    const scene = p.scenes[0]!;
    const at = (mode: 'edit' | 'play', t: number) => evaluateScene(scene, t, { mode })[0]!.matrix;
    expect(at('edit', 0.7 * S)).toEqual(at('edit', 1.4 * S));
    expect(at('play', 2.7 * S)).not.toEqual(at('play', 3.4 * S));
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    item.life = { kind: 'float', amount: 9 };
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { inkPressures, inkTaper, LazyBrush, strokeLength } from '@core/draw/assist';
import { recognizeShape } from '@core/draw/recognize';
import type { Point } from '@core/geometry/matrix';

/** Ruido determinista para simular el pulso. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
}
const shaky = (pts: Point[], amp: number, seed = 1) => {
  const r = rng(seed);
  return pts.map((p) => ({ x: p.x + r() * amp, y: p.y + r() * amp }));
};
const polyline = (vs: Point[], perEdge = 20) =>
  vs.slice(1).flatMap((b, i) => {
    const a = vs[i]!;
    return Array.from({ length: perEdge }, (_, k) => ({
      x: a.x + ((b.x - a.x) * k) / perEdge,
      y: a.y + ((b.y - a.y) * k) / perEdge,
    }));
  });
const ellipse = (cx: number, cy: number, a: number, b: number, turns = 1.04, n = 80) =>
  Array.from({ length: n }, (_, i) => {
    const t = -Math.PI / 2 + (2 * Math.PI * turns * i) / (n - 1);
    return { x: cx + a * Math.cos(t), y: cy + b * Math.sin(t) };
  });

describe('formas rápidas', () => {
  it('un círculo tembloroso se convierte en un círculo limpio', () => {
    const r = recognizeShape(shaky(ellipse(300, 200, 100, 94), 8))!;
    expect(r.kind).toBe('circle');
    expect(r.closed).toBe(true);
    const ring = r.points.slice(0, -1);
    const c = {
      x: ring.reduce((a, p) => a + p.x, 0) / ring.length,
      y: ring.reduce((a, p) => a + p.y, 0) / ring.length,
    };
    expect(Math.hypot(c.x - 300, c.y - 200)).toBeLessThan(8);
    const radii = r.points.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
    for (const d of radii) expect(Math.abs(d - radii[0]!)).toBeLessThan(0.001);
    expect(radii[0]).toBeGreaterThan(90);
    expect(radii[0]).toBeLessThan(105);
    expect(r.points[0]).toEqual(r.points[r.points.length - 1]);
  });

  it('una elipse alargada sigue siendo elipse', () => {
    expect(recognizeShape(shaky(ellipse(0, 0, 200, 80), 6))?.kind).toBe('ellipse');
  });

  it('un rectángulo a mano sale recto y con esquinas exactas', () => {
    const r = recognizeShape(
      shaky(
        polyline([
          { x: 0, y: 0 },
          { x: 300, y: 6 },
          { x: 296, y: 180 },
          { x: -4, y: 176 },
          { x: 2, y: 4 },
        ]),
        5,
      ),
    )!;
    expect(r.kind).toBe('rectangle');
    const xs = [...new Set(r.points.map((p) => Math.round(p.x)))];
    // Lados verticales exactos: solo dos valores de x en las esquinas.
    expect(Math.min(...xs)).toBeLessThan(5);
    expect(Math.max(...xs)).toBeGreaterThan(290);
    const corners = r.points.filter((p) => Math.abs(p.x - Math.min(...xs)) < 1 || Math.abs(p.x - Math.max(...xs)) < 1);
    expect(corners.length).toBeGreaterThan(4);
  });

  it('un triángulo y un pentágono se quedan con sus vértices', () => {
    const tri = recognizeShape(
      shaky(
        polyline([
          { x: 0, y: 200 },
          { x: 120, y: 0 },
          { x: 240, y: 200 },
          { x: 4, y: 196 },
        ]),
        5,
        2,
      ),
    );
    expect(tri?.kind).toBe('triangle');
    const pent = Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / 5;
      return { x: 200 * Math.cos(a), y: 200 * Math.sin(a) };
    });
    expect(recognizeShape(shaky(polyline(pent), 4, 3))?.kind).toBe('polygon');
  });

  it('una línea casi recta queda recta (y horizontal si casi lo es)', () => {
    const pts = shaky(
      Array.from({ length: 50 }, (_, i) => ({ x: i * 8, y: 100 + i * 0.3 })),
      4,
    );
    const r = recognizeShape(pts)!;
    expect(r.kind).toBe('line');
    expect(r.closed).toBe(false);
    const ys = r.points.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.001);
  });

  it('garabatos, curvas abiertas y espirales se dejan como están', () => {
    const r = rng(7);
    const scribble = Array.from({ length: 60 }, () => ({ x: r() * 300, y: r() * 300 }));
    expect(recognizeShape(scribble)).toBeNull();
    const s = Array.from({ length: 60 }, (_, i) => ({ x: i * 6, y: 80 * Math.sin(i / 8) }));
    expect(recognizeShape(s)).toBeNull();
    const spiral = Array.from({ length: 120 }, (_, i) => {
      const t = i / 10;
      return { x: t * 12 * Math.cos(t), y: t * 12 * Math.sin(t) };
    });
    expect(recognizeShape(spiral)).toBeNull();
    expect(recognizeShape([{ x: 0, y: 0 }])).toBeNull();
  });
});

describe('estabilizador y tinta', () => {
  it('el pincel con cuerda ignora los temblores pequeños y sigue al puntero a distancia', () => {
    const b = new LazyBrush(10);
    expect(b.update(0, 0)).toEqual({ x: 0, y: 0 });
    expect(b.update(5, 3)).toBeNull();
    const p = b.update(30, 0)!;
    expect(Math.hypot(30 - p.x, 0 - p.y)).toBeCloseTo(10);
    const tail = b.catchUp(30, 0, 2);
    expect(tail[tail.length - 1]).toEqual({ x: 30, y: 0 });
    expect(tail.length).toBe(5);
    // Sin radio, pasa tal cual.
    const free = new LazyBrush(0);
    free.update(0, 0);
    expect(free.update(1, 1)).toEqual({ x: 1, y: 1 });
  });

  it('la tinta adelgaza deprisa, engorda despacio y no toca la presión real', () => {
    // 20 puntos lentos y 20 rápidos (unidades por ms a zoom 1).
    const pts: number[] = [];
    let x = 0;
    let t = 0;
    for (let i = 0; i < 40; i++) {
      x += i < 20 ? 0.5 : 30;
      t += 10;
      pts.push(x, 0, -1, t);
    }
    const out = inkPressures(pts, 1);
    expect(out[19 * 4 + 2]).toBeGreaterThan(out[39 * 4 + 2]! + 0.3);
    for (let i = 0; i < 40; i++) expect(out[i * 4 + 2]).toBeGreaterThan(0);
    const pen = [0, 0, 0.4, 0, 10, 0, 0.6, 10];
    expect(inkPressures(pen, 1)).toBe(pen);
    expect(strokeLength(pts)).toBeGreaterThan(600);
    expect(inkTaper(pts, 8)).toBe(20);
    expect(inkTaper([0, 0, -1, 0, 10, 0, -1, 10], 8)).toBe(2.2);
  });
});

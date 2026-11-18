import { describe, expect, it } from 'vitest';
import { fillRegion, simplifyRing, traceRegion, type Raster } from '@core/draw/fill';
import { pointInPolygon } from '@core/geometry/items';

/** Hoja blanca de w×h con los píxeles que cumplan `ink` en negro. */
function raster(w: number, h: number, ink: (x: number, y: number) => boolean): Raster {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (ink(x + 0.5, y + 0.5)) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
  return { width: w, height: h, data };
}

/** Anillo de radio `r` y grosor `t` centrado en (cx, cy); `gap` abre un hueco a la derecha. */
const ring =
  (cx: number, cy: number, r: number, t: number, gap = 0) =>
  (x: number, y: number) => {
    const d = Math.hypot(x - cx, y - cy);
    if (Math.abs(d - r) > t / 2) return false;
    return !(gap && x > cx && Math.abs(y - cy) < gap / 2);
  };

describe('bote de pintura: zona', () => {
  it('rellena el interior de un dibujo cerrado, un poco por debajo de la línea', () => {
    const img = raster(100, 100, ring(50, 50, 30, 4));
    const f = fillRegion(img, 50, 50)!;
    expect(f.gap).toBe(0);
    // Interior del círculo (radio ≈ 28) más 1 px bajo la línea.
    expect(f.area).toBeGreaterThan(Math.PI * 28 * 28);
    expect(f.area).toBeLessThan(Math.PI * 30 * 30);
    expect(f.mask[50 * 100 + 50]).toBe(1);
    expect(f.mask[50 * 100 + 95]).toBe(0); // fuera
  });

  it('cierra solo un hueco pequeño en vez de inundar la hoja', () => {
    const img = raster(120, 120, ring(60, 60, 35, 4, 8));
    const f = fillRegion(img, 60, 60)!;
    expect(f.gap).toBeGreaterThan(0);
    expect(f.area).toBeLessThan(Math.PI * 38 * 38);
    expect(f.mask[5 * 120 + 5]).toBe(0); // la esquina de la hoja sigue sin pintar
  });

  it('una zona que acaba en el borde de la hoja (el cielo) se rellena entera', () => {
    // Horizonte de lado a lado: el cielo toca el borde, pero no es un escape.
    const img = raster(80, 60, (_x, y) => Math.abs(y - 40) < 2);
    const f = fillRegion(img, 40, 10)!;
    expect(f.gap).toBe(0);
    expect(f.mask[5 * 80 + 2]).toBe(1);
    expect(f.mask[55 * 80 + 40]).toBe(0); // bajo el horizonte no
  });

  it('un punto diminuto o fuera de la imagen no rellena nada', () => {
    const img = raster(60, 60, (x, y) => Math.abs(x - 30) < 1 && Math.abs(y - 30) < 1);
    expect(fillRegion(img, 30, 30)).toBeNull();
    expect(fillRegion(img, -1, 30)).toBeNull();
  });
});

describe('bote de pintura: contorno', () => {
  it('el contorno exterior rodea la zona y los agujeros quedan fuera', () => {
    // Cielo con una nube cerrada (blanca por dentro): la nube es un agujero del relleno.
    const img = raster(120, 80, (x, y) => Math.abs(y - 60) < 2 || ring(60, 25, 12, 3)(x, y));
    const f = fillRegion(img, 10, 10)!;
    const c = traceRegion(f.mask, 120, 80)!;
    expect(c.holes).toHaveLength(1);
    const inside = (x: number, y: number) =>
      pointInPolygon({ x, y }, c.outer) && !c.holes.some((hl) => pointInPolygon({ x, y }, hl));
    expect(inside(10, 10)).toBe(true);
    expect(inside(60, 25)).toBe(false); // dentro de la nube
    expect(inside(60, 75)).toBe(false); // bajo el horizonte
    expect(c.outer.length / 2).toBeLessThan(80); // simplificado
  });

  it('respeta el máximo de vértices', () => {
    const img = raster(200, 200, ring(100, 100, 80, 3));
    const f = fillRegion(img, 100, 100)!;
    const c = traceRegion(f.mask, 200, 200, { maxPoints: 20 })!;
    expect(c.outer.length / 2).toBeLessThanOrEqual(20);
    expect(c.outer.length / 2).toBeGreaterThanOrEqual(6);
  });

  it('simplificar un cuadrado deja sus cuatro esquinas', () => {
    const sq: number[] = [];
    for (let i = 0; i < 10; i++) sq.push(i, 0);
    for (let i = 0; i < 10; i++) sq.push(10, i);
    for (let i = 10; i > 0; i--) sq.push(i, 10);
    for (let i = 10; i > 0; i--) sq.push(0, i);
    const s = simplifyRing(sq, 0.5);
    expect(s).toHaveLength(8);
  });
});

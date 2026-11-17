import { describe, expect, it } from 'vitest';
import { valueAt } from '@core/anim/animated';
import { createShape, createStroke, createText } from '@core/model/factory';
import { hitItem, localBounds, worldBounds, worldCorners } from '@core/geometry/items';
import { apply, invert, matrixFrom, multiply, rotateDeg, translate, type StaticTransform } from '@core/geometry/matrix';
import { resizeGroup, resizeSingle, rotateGroup, snapAngle } from '@core/geometry/manipulate';
import { ticksFromSeconds } from '@core/time/ticks';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);
const style = { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 };
const staticOf = (t: ReturnType<typeof createShape>['transform']): StaticTransform => ({
  x: (t.x as { value: number }).value,
  y: (t.y as { value: number }).value,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  anchorX: t.anchorX,
  anchorY: t.anchorY,
});

describe('matrices', () => {
  it('invertir y multiplicar devuelve la identidad', () => {
    const m = multiply(translate(10, -4), rotateDeg(33));
    const p = apply(multiply(m, invert(m)), { x: 7, y: 3 });
    close(p.x, 7);
    close(p.y, 3);
  });

  it('la matriz de un elemento rota y escala alrededor de su ancla', () => {
    const t: StaticTransform = { x: 100, y: 50, scaleX: 2, scaleY: 2, rotation: 90, anchorX: 10, anchorY: 0 };
    const m = matrixFrom(t);
    const anchorWorld = apply(m, { x: 10, y: 0 });
    close(anchorWorld.x, 110);
    close(anchorWorld.y, 50);
    const p = apply(m, { x: 20, y: 0 }); // 10 a la derecha del ancla → girado 90° y escalado ×2
    close(p.x, 110);
    close(p.y, 70);
  });
});

describe('valores animados', () => {
  it('interpola entre keyframes y mantiene los extremos', () => {
    const s = ticksFromSeconds(1);
    const a = {
      keys: [
        { t: 0, v: 0, ease: 'linear' as const },
        { t: s, v: 100, ease: 'hold' as const },
        { t: 2 * s, v: 50, ease: 'linear' as const },
      ],
    };
    expect(valueAt(a, -5)).toBe(0);
    expect(valueAt(a, s / 2)).toBe(50);
    expect(valueAt(a, s * 1.5)).toBe(100); // hold
    expect(valueAt(a, 3 * s)).toBe(50);
  });
});

describe('cajas y detección de impacto', () => {
  it('la caja de un trazo incluye su grosor', () => {
    const s = createStroke([0, 0, -1, 0, 100, 0, -1, 10], { color: '#000000', size: 10, opacity: 1 });
    expect(localBounds(s)).toEqual({ x: -5, y: -5, w: 110, h: 10 });
  });

  it('detecta trazos, formas y textos con tolerancia y transformaciones', () => {
    const s = createStroke([0, 0, -1, 0, 100, 0, -1, 10], { color: '#000000', size: 10, opacity: 1 });
    expect(hitItem(s, { x: 50, y: 6 }, 2)).toBe(true);
    expect(hitItem(s, { x: 50, y: 20 }, 2)).toBe(false);

    const hollow = createShape('rect', 0, 0, 100, 50, style);
    expect(hitItem(hollow, { x: 50, y: 25 }, 1)).toBe(false); // interior sin relleno
    expect(hitItem(hollow, { x: 0, y: 25 }, 1)).toBe(true); // borde
    const filled = createShape('ellipse', 0, 0, 100, 50, { ...style, fill: '#ff0000' });
    expect(hitItem(filled, { x: 50, y: 25 }, 1)).toBe(true);
    expect(hitItem(filled, { x: 2, y: 2 }, 1)).toBe(false); // esquina fuera de la elipse

    const text = createText(10, 10, {
      text: 'Hola',
      font: 'hand',
      size: 40,
      color: '#000000',
      align: 'left',
      lineHeight: 1.2,
      w: 80,
      h: 48,
    });
    expect(hitItem(text, { x: 50, y: 30 }, 0)).toBe(true);
    expect(hitItem(text, { x: 5, y: 5 }, 0)).toBe(false);
  });

  it('la caja de escena de una forma rotada 90° intercambia ancho y alto', () => {
    const r = createShape('rect', 0, 0, 100, 40, { ...style, stroke: null });
    r.transform.rotation = { value: 90 };
    const b = worldBounds(r);
    close(b.w, 40);
    close(b.h, 100);
    close(b.x + b.w / 2, 50);
    close(b.y + b.h / 2, 20);
  });
});

describe('manipulación', () => {
  it('redimensionar desde la esquina deja fija la opuesta', () => {
    const r = createShape('rect', 0, 0, 100, 50, { ...style, stroke: null });
    const t0 = staticOf(r.transform);
    const t = resizeSingle(r, t0, 'se', { x: 200, y: 150 }, false);
    close(t.scaleX, 2);
    close(t.scaleY, 3);
    const corners = worldCorners({
      ...r,
      transform: {
        ...r.transform,
        x: { value: t.x },
        y: { value: t.y },
        scaleX: { value: t.scaleX },
        scaleY: { value: t.scaleY },
      },
    });
    close(corners[0]!.x, 0);
    close(corners[0]!.y, 0);
    close(corners[2]!.x, 200);
    close(corners[2]!.y, 150);
  });

  it('con mayúsculas mantiene la proporción y nunca invierte el elemento', () => {
    const r = createShape('rect', 0, 0, 100, 50, { ...style, stroke: null });
    const t0 = staticOf(r.transform);
    const prop = resizeSingle(r, t0, 'se', { x: 300, y: 60 }, true);
    close(prop.scaleX, prop.scaleY);
    const crushed = resizeSingle(r, t0, 'se', { x: -500, y: -500 }, false);
    expect(crushed.scaleX).toBeGreaterThan(0);
    expect(crushed.scaleY).toBeGreaterThan(0);
  });

  it('escala de grupo uniforme respecto a la esquina opuesta', () => {
    const a = staticOf(createShape('rect', 0, 0, 10, 10, style).transform);
    const b = staticOf(createShape('rect', 90, 90, 10, 10, style).transform);
    const [a2, b2] = resizeGroup([a, b], { x: 0, y: 0, w: 100, h: 100 }, 'se', { x: 200, y: 200 });
    close(a2!.scaleX, 2);
    close(b2!.x + b2!.anchorX, 190); // el centro de b (95) se escala ×2 desde (0,0)
  });

  it('rotar un grupo gira posiciones alrededor del centro', () => {
    const a = staticOf(createShape('rect', 100, -5, 10, 10, style).transform); // centro (105, 0)
    const [r] = rotateGroup([a], { x: 0, y: 0 }, 90);
    close(r!.x + r!.anchorX, 0);
    close(r!.y + r!.anchorY, 105);
    expect(r!.rotation).toBe(90);
    expect(snapAngle(52)).toBe(45);
  });
});

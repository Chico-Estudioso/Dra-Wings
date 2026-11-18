import { describe, expect, it } from 'vitest';
import { cameraMatrix, cameraRect, hasCamera } from '@core/render/evaluate';
import { apply } from '@core/geometry/matrix';
import { createProject, createShape } from '@core/model/factory';
import { validateProject } from '@core/model/validate';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const page = { width: 1920, height: 1080 };

function setup() {
  const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
  const r = createShape('rect', 0, 400, 100, 100, { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 });
  // Cruza la hoja de izquierda a derecha entre 0 y 4 s.
  r.transform.x = {
    keys: [
      { t: 0, v: 0, ease: 'linear' },
      { t: 4 * S, v: 1800, ease: 'linear' },
    ],
  };
  p.scenes[0]!.layers[0]!.items!.push(r);
  return { p, scene: p.scenes[0]!, r };
}

describe('cámara que sigue', () => {
  it('sin seguir, es la cámara manual', () => {
    const { scene } = setup();
    expect(cameraRect(scene, S, page)).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(hasCamera(scene)).toBe(false);
  });

  it('se centra en el elemento con un poco de retraso y sin salirse de la hoja', () => {
    const { scene, r, p } = setup();
    scene.follow = { id: r.id, zoom: 2 };
    expect(hasCamera(scene)).toBe(true);
    const c = cameraRect(scene, 2 * S, page);
    expect(c.zoom).toBe(2);
    // El centro del encuadre va un poco por detrás del elemento (que está en x≈950).
    const centerX = c.x + page.width / 2 / 2;
    expect(centerX).toBeLessThan(950);
    expect(centerX).toBeGreaterThan(800);
    // Vertical: centrado en él (y≈450).
    expect(c.y + page.height / 2 / 2).toBeCloseTo(450, 0);
    // Al principio y al final se pega a los bordes de la hoja.
    expect(cameraRect(scene, 0, page).x).toBe(0);
    expect(cameraRect(scene, 4 * S, page).x).toBe(page.width - page.width / 2);
    // La matriz lleva el centro del encuadre al centro de la hoja.
    const m = cameraMatrix(scene, 2 * S, page);
    const mid = apply(m, { x: c.x + page.width / 4, y: c.y + page.height / 4 });
    expect(mid.x).toBeCloseTo(page.width / 2);
    expect(mid.y).toBeCloseTo(page.height / 2);
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });

  it('si el elemento ya no existe o no se sabe el tamaño de la hoja, vuelve a la manual', () => {
    const { scene } = setup();
    scene.follow = { id: 'no-existe', zoom: 2 };
    expect(cameraRect(scene, S, page)).toEqual({ x: 0, y: 0, zoom: 1 });
    const { scene: s2, r } = setup();
    s2.follow = { id: r.id, zoom: 2 };
    expect(cameraRect(s2, S)).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

import { describe, expect, it } from 'vitest';
import { boilAt, jitterMatrix, seedOf, strokeBoilAmp, wobblePoints } from '@core/render/boil';
import { strokeOutline } from '@core/render/stroke-outline';
import { apply } from '@core/geometry/matrix';
import { createProject, createStroke } from '@core/model/factory';
import { validateProject } from '@core/model/validate';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const frame = (n: number, fps: number) => (n * S) / fps;
const line = () =>
  createStroke(Array.from({ length: 40 }, (_, i) => [i * 10, 0, -1, i * 16]).flat(), {
    color: '#000000',
    size: 8,
    opacity: 1,
  });

describe('trazo vivo', () => {
  it('quieto no tiembla; si no, alterna 3 variantes a ritmo regular', () => {
    expect(boilAt(undefined, 0, 30)).toBeNull();
    expect(boilAt('off', S, 30)).toBeNull();
    // 24 fps: cambia cada 3 fotogramas (8 por segundo).
    expect([0, 2, 3, 5, 6, 8, 9].map((n) => boilAt('medium', frame(n, 24), 24)!.variant)).toEqual([
      0, 0, 1, 1, 2, 2, 0,
    ]);
    // 30 fps: cada 4 fotogramas.
    expect([0, 3, 4, 8, 12].map((n) => boilAt('medium', frame(n, 30), 30)!.variant)).toEqual([0, 0, 1, 2, 0]);
    expect(boilAt('strong', 0, 30)!.amount).toBeGreaterThan(boilAt('soft', 0, 30)!.amount);
  });

  it('las líneas ondulan poco, siempre igual para el mismo elemento y distinto en cada variante', () => {
    const input = Array.from({ length: 50 }, (_, i) => [i * 8, 100, 0.5]);
    const seed = seedOf('trazo-1');
    const a = wobblePoints(input, seed, 0, 2, 40);
    expect(wobblePoints(input, seed, 0, 2, 40)).toEqual(a);
    const b = wobblePoints(input, seed, 1, 2, 40);
    expect(b).not.toEqual(a);
    expect(wobblePoints(input, seedOf('trazo-2'), 0, 2, 40)).not.toEqual(a);
    for (const [i, p] of a.entries()) {
      expect(Math.abs(p[0]! - input[i]![0]!)).toBeLessThanOrEqual(2);
      expect(Math.abs(p[1]! - 100)).toBeLessThanOrEqual(2);
      expect(p[2]).toBe(0.5);
    }
    // Ondula suave: puntos vecinos se desplazan casi igual (no es ruido punto a punto).
    for (let i = 1; i < a.length; i++) expect(Math.abs(a[i]![1]! - a[i - 1]![1]!)).toBeLessThan(1);
    // Un trazo a medio dibujar tiembla igual que el completo en la parte ya dibujada.
    expect(wobblePoints(input.slice(0, 20), seed, 0, 2, 40)).toEqual(a.slice(0, 20));
  });

  it('el contorno del trazo cambia con el temblor y es reproducible', () => {
    const s = line();
    const still = strokeOutline(s);
    const v0 = strokeOutline(s, 1, { variant: 0, amount: 1 });
    expect(v0).not.toEqual(still);
    expect(strokeOutline(s, 1, { variant: 0, amount: 1 })).toEqual(v0);
    expect(strokeOutline(s, 1, { variant: 1, amount: 1 })).not.toEqual(v0);
    expect(strokeBoilAmp(200, 1)).toBe(2.5); // con tope aunque el trazo sea muy grueso
  });

  it('formas y textos se mueven unas pocas unidades en sus bordes', () => {
    const m = jitterMatrix(seedOf('forma'), 2, 400, 200, 2);
    expect(jitterMatrix(seedOf('forma'), 2, 400, 200, 2)).toEqual(m);
    expect(jitterMatrix(seedOf('forma'), 0, 400, 200, 2)).not.toEqual(m);
    for (const c of [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 0, y: 200 },
    ]) {
      const q = apply(m, c);
      expect(Math.hypot(q.x - c.x, q.y - c.y)).toBeLessThan(5);
    }
  });

  it('los proyectos nuevos lo traen activado y los antiguos (sin el campo) siguen siendo válidos', () => {
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    expect(p.settings.boil).toBe('medium');
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    const old = JSON.parse(JSON.stringify(p));
    delete old.settings.boil;
    expect(validateProject(old).ok).toBe(true);
    expect(validateProject({ ...old, settings: { ...old.settings, boil: 'mucho' } }).ok).toBe(false);
  });
});

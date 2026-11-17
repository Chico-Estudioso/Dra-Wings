import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createProject, createShape, createStroke } from '@core/model/factory';
import { densify, eraseItems, eraseStroke } from '@core/edit/erase';
import {
  addItem,
  addLayer,
  duplicateItems,
  moveLayer,
  removeItems,
  removeLayer,
  reorderItems,
  selectableItems,
  translateItems,
} from '@core/edit/ops';
import { evaluateScene } from '@core/render/evaluate';
import { partialInput, strokeOutline } from '@core/render/stroke-outline';
import { validateProject } from '@core/model/validate';
import { ticksFromSeconds } from '@core/time/ticks';
import type { Item, Project } from '@core/model/types';

const line = (x0: number, x1: number, y = 0, n = 11) => {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) pts.push(x0 + ((x1 - x0) * i) / (n - 1), y, -1, i * 10);
  return createStroke(pts, { color: '#000000', size: 4, opacity: 1 });
};
const base = () => createProject({ name: 'p', aspect: 'landscape', fps: 30, mode: 'free' });
const ids = (items: Item[]) => items.map((i) => i.id);

describe('goma', () => {
  it('parte un trazo en dos por donde pasa', () => {
    const s = line(0, 100);
    const pieces = eraseStroke(
      s,
      [
        { x: 50, y: -20 },
        { x: 50, y: 20 },
      ],
      5,
    )!;
    expect(pieces).toHaveLength(2);
    for (const p of pieces) {
      expect(p.id).not.toBe(s.id);
      expect(p.style).toEqual(s.style);
    }
    const maxLeft = Math.max(...pieces[0]!.points.filter((_, i) => i % 4 === 0));
    const minRight = Math.min(...pieces[1]!.points.filter((_, i) => i % 4 === 0));
    expect(maxLeft).toBeLessThan(50);
    expect(minRight).toBeGreaterThan(50);
  });

  it('devuelve null si no toca y nada si lo borra entero', () => {
    const s = line(0, 100);
    expect(eraseStroke(s, [{ x: 50, y: 100 }], 5)).toBeNull();
    expect(
      eraseStroke(
        s,
        [
          { x: -10, y: 0 },
          { x: 110, y: 0 },
        ],
        5,
      ),
    ).toEqual([]);
  });

  it('densify interpola tramos largos para no saltarse la goma', () => {
    const pts = densify([0, 0, 0.5, 0, 100, 0, 1, 100], 10);
    expect(pts.length / 4).toBe(11);
    expect(pts.slice(-4)).toEqual([100, 0, 1, 100]);
  });

  it('elimina formas completas al tocarlas', () => {
    const r = createShape('rect', 0, 0, 50, 50, { stroke: '#000000', strokeWidth: 2, fill: null, opacity: 1 });
    const { replacements } = eraseItems([r, line(200, 300)], [{ x: 0, y: 25 }], 3);
    expect([...replacements]).toEqual([[r.id, []]]);
  });
});

describe('operaciones de escena', () => {
  it('añadir, duplicar, mover, ordenar y borrar elementos', () => {
    const p0 = base();
    const layerId = p0.scenes[0]!.layers[0]!.id;
    const a = line(0, 10);
    const b = line(20, 30);
    let created: string[] = [];
    const p1 = produce(p0, (d: Project) => {
      const sc = d.scenes[0]!;
      addItem(sc, layerId, a);
      addItem(sc, layerId, b);
      created = duplicateItems(sc, [a.id]);
      translateItems(sc, [b.id], 5, -5);
      reorderItems(sc, new Set([a.id]), 'front');
    });
    const items = p1.scenes[0]!.layers[0]!.items!;
    expect(ids(items)).toEqual([created[0], b.id, a.id]);
    expect(items[1]!.transform.x).toEqual({ value: 5 });
    expect(items[0]!.transform.x).toEqual({ value: 24 });
    const p2 = produce(p1, (d: Project) => removeItems(d.scenes[0]!, new Set([a.id, created[0]!])));
    expect(ids(p2.scenes[0]!.layers[0]!.items!)).toEqual([b.id]);
    expect(validateProject(p2).ok).toBe(true);
  });

  it('capas: crear encima de la activa, reordenar, eliminar y nunca quedarse sin ninguna', () => {
    const p0 = base();
    const first = p0.scenes[0]!.layers[0]!.id;
    let second = '';
    let afterRemove = '';
    const p1 = produce(p0, (d: Project) => {
      const sc = d.scenes[0]!;
      second = addLayer(sc, first);
      moveLayer(sc, second, 'down');
    });
    expect(p1.scenes[0]!.layers.map((l) => l.id)).toEqual([second, first]);
    expect(p1.scenes[0]!.layers[0]!.name).toBe('Capa 2');
    const p2 = produce(p1, (d: Project) => {
      afterRemove = removeLayer(d.scenes[0]!, first);
    });
    expect(afterRemove).toBe(second);
    const p3 = produce(p2, (d: Project) => void removeLayer(d.scenes[0]!, second));
    expect(p3.scenes[0]!.layers).toHaveLength(1);
  });

  it('solo se pueden seleccionar elementos de capas visibles y desbloqueadas', () => {
    const p = produce(base(), (d: Project) => {
      const sc = d.scenes[0]!;
      addItem(sc, sc.layers[0]!.id, line(0, 10));
      const hiddenId = addLayer(sc);
      addItem(sc, hiddenId, line(0, 10));
      sc.layers[1]!.visible = false;
    });
    expect(selectableItems(p.scenes[0]!)).toHaveLength(1);
  });
});

describe('evaluación y trazos progresivos', () => {
  it('en edición todo es visible; en reproducción respeta entrada y revelado', () => {
    const sec = ticksFromSeconds(1);
    const s = { ...line(0, 100), in: sec, reveal: { start: sec, duration: 2 * sec, mode: 'length' as const } };
    const scene = { ...base().scenes[0]!, layers: [{ ...base().scenes[0]!.layers[0]!, items: [s] }] };
    expect(evaluateScene(scene, 0, { mode: 'edit' })).toHaveLength(1);
    expect(evaluateScene(scene, 0, { mode: 'play' })).toHaveLength(0);
    const mid = evaluateScene(scene, 2 * sec, { mode: 'play' });
    expect(mid[0]!.progress).toBeCloseTo(0.5);
    expect(evaluateScene(scene, 10 * sec, { mode: 'play' })[0]!.progress).toBe(1);
  });

  it('el revelado por longitud interpola el último punto y es determinista', () => {
    const s = line(0, 100);
    const half = partialInput(s, 0.5);
    expect(half.at(-1)![0]).toBeCloseTo(50);
    expect(partialInput(s, 0.55).at(-1)![0]).toBeCloseTo(55);
    expect(strokeOutline(s, 0.37)).toEqual(strokeOutline(s, 0.37));
    expect(strokeOutline(s, 0)).toEqual([]);
  });

  it('sin presión del dispositivo usa presión neutra (grosor constante, sin simular)', () => {
    const input = partialInput(line(0, 100), 1);
    expect(input.every((p) => p[2] === 0.5)).toBe(true);
  });
});

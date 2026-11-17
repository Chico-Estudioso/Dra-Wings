import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createProject, createShape, createStroke } from '@core/model/factory';
import { groupItems, makeGroup, recolorSlot, ungroupItem } from '@core/edit/group';
import { addItem } from '@core/edit/ops';
import { hitItem, worldBounds, worldCorners } from '@core/geometry/items';
import { apply } from '@core/geometry/matrix';
import { CATEGORIES, LIBRARY, searchLibrary } from '@core/library/catalog';
import {
  buildCharacter,
  DEFAULT_CHARACTER,
  EXPRESSIONS,
  HAIR_STYLES,
  POSES,
  type CharacterOptions,
} from '@core/library/character';
import { placeGroup, TEMPLATES } from '@core/library/place';
import { evaluateScene } from '@core/render/evaluate';
import { validateProject } from '@core/model/validate';
import type { Group, Item, Project } from '@core/model/types';

const base = () => createProject({ name: 'p', aspect: 'landscape', fps: 30, mode: 'guided' });
const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

function projectWith(items: Item[]): Project {
  return produce(base(), (d: Project) => {
    const sc = d.scenes[0]!;
    for (const it of items) addItem(sc, sc.layers[0]!.id, it);
  });
}

function leafCount(items: Item[]): number {
  return items.reduce((n, i) => n + (i.type === 'group' ? leafCount(i.children) : 1), 0);
}

/** Estructura sin ids (los ids son aleatorios). */
function shape(items: Item[]): unknown {
  return items.map((i) => {
    const { id: _id, ...rest } = i as Item & { children?: Item[] };
    return i.type === 'group' ? { ...rest, children: shape(i.children) } : rest;
  });
}

describe('polígonos', () => {
  it('detecta el interior relleno y el borde de un polígono', () => {
    const tri = createShape('polygon', 0, 0, 100, 100, { stroke: null, strokeWidth: 0, fill: '#ff0000', opacity: 1 });
    tri.points = [0, 100, 50, 0, 100, 100];
    expect(hitItem(tri, { x: 50, y: 70 }, 0)).toBe(true);
    expect(hitItem(tri, { x: 5, y: 5 }, 0)).toBe(false);
  });
});

describe('grupos', () => {
  const line = () => createStroke([10, 10, -1, 0, 60, 10, -1, 10], { color: '#000000', size: 4, opacity: 1 });

  it('makeGroup lleva los hijos al origen y coloca el grupo donde estaban', () => {
    const items = [
      line(),
      createShape('rect', 100, 50, 40, 20, { stroke: '#000000', strokeWidth: 2, fill: null, opacity: 1 }),
    ];
    const before = items.map((i) => worldBounds(i));
    const g = makeGroup(structuredClone(items));
    const scene = projectWith([g]).scenes[0]!;
    const list = evaluateScene(scene, 0, { mode: 'edit' });
    expect(list).toHaveLength(2);
    // La caja local del grupo empieza en (0, 0) y su posición es la esquina original.
    expect(g.transform.x).toEqual({ value: Math.min(...before.map((b) => b.x)) });
    expect(g.w).toBeGreaterThan(0);
  });

  it('agrupar y desagrupar conserva la posición de cada elemento aunque el grupo esté rotado y escalado', () => {
    const a = line();
    const r = createShape('rect', 100, 50, 40, 20, { stroke: '#000000', strokeWidth: 2, fill: '#00ff00', opacity: 1 });
    let p = projectWith([a, r]);
    let gid = '';
    p = produce(p, (d: Project) => {
      gid = groupItems(d.scenes[0]!, [a.id, r.id])!;
    });
    expect(p.scenes[0]!.layers[0]!.items).toHaveLength(1);
    // Rotar y escalar el grupo y comprobar dónde quedan los hijos.
    p = produce(p, (d: Project) => {
      const g = d.scenes[0]!.layers[0]!.items![0]!;
      g.transform.rotation = { value: 30 };
      g.transform.scaleX = { value: 1.5 };
      g.transform.scaleY = { value: 1.5 };
    });
    const expected = evaluateScene(p.scenes[0]!, 0, { mode: 'edit' });
    p = produce(p, (d: Project) => void ungroupItem(d.scenes[0]!, gid));
    const items = p.scenes[0]!.layers[0]!.items!;
    expect(items).toHaveLength(2);
    const after = evaluateScene(p.scenes[0]!, 0, { mode: 'edit' });
    // Misma geometría en escena antes y después de desagrupar: puntos de los trazos y esquinas de las formas.
    const geometry = (r: (typeof after)[number]) =>
      r.item.type === 'stroke'
        ? [0, r.item.points.length - 4].map((i) =>
            apply(r.matrix, {
              x: (r.item as { points: number[] }).points[i]!,
              y: (r.item as { points: number[] }).points[i + 1]!,
            }),
          )
        : worldCorners(r.item, 0, r.matrix);
    for (let i = 0; i < 2; i++) {
      const g1 = geometry(expected[i]!);
      const g2 = geometry(after[i]!);
      g1.forEach((pt, k) => {
        close(pt.x, g2[k]!.x, 1e-6);
        close(pt.y, g2[k]!.y, 1e-6);
      });
    }
    // El grosor del trazo se escala con el grupo.
    expect(after[0]!.item.type === 'stroke' && after[0]!.item.style.size).toBeCloseTo(6);
    expect(validateProject(p).ok).toBe(true);
  });

  it('no agrupa elementos de capas distintas ni uno solo', () => {
    const a = line();
    const p = projectWith([a]);
    produce(p, (d: Project) => {
      expect(groupItems(d.scenes[0]!, [a.id])).toBeNull();
    });
  });

  it('recolorea por ranura en todo el grupo, incluidos subgrupos', () => {
    const g = buildCharacter(DEFAULT_CHARACTER);
    const next = produce(g, (d: Group) => recolorSlot(d, 'shirt', '#123456'));
    expect(next.slots!.find((s) => s.id === 'shirt')!.color).toBe('#123456');
    const colors = JSON.stringify(next);
    expect(colors).toContain('#123456');
    expect(colors).not.toContain(DEFAULT_CHARACTER.shirt);
  });
});

describe('biblioteca', () => {
  it('cada recurso se construye como grupo válido y determinista', () => {
    const groups = LIBRARY.map((a) => a.build());
    expect(validateProject(projectWith(groups)).ok).toBe(true);
    for (const a of LIBRARY) expect(shape([a.build()])).toEqual(shape([a.build()]));
    expect(new Set(LIBRARY.map((a) => a.id)).size).toBe(LIBRARY.length);
    expect(LIBRARY.every((a) => CATEGORIES.some((c) => c.id === a.category))).toBe(true);
    expect(LIBRARY.length).toBeGreaterThanOrEqual(35);
  });

  it('la búsqueda ignora tildes y busca en etiquetas', () => {
    expect(searchLibrary('arbol').map((a) => a.id)).toContain('arbol');
    expect(searchLibrary('dinero').map((a) => a.id)).toContain('monedas');
    expect(searchLibrary('', 'vehiculos').every((a) => a.category === 'vehiculos')).toBe(true);
  });

  it('todas las combinaciones de personaje son válidas', () => {
    const all: Group[] = [];
    for (const hair of Object.keys(HAIR_STYLES))
      for (const expression of Object.keys(EXPRESSIONS))
        for (const pose of Object.keys(POSES))
          all.push(buildCharacter({ ...DEFAULT_CHARACTER, hair, expression, pose } as CharacterOptions));
    expect(all).toHaveLength(216);
    expect(validateProject(projectWith(all)).ok).toBe(true);
    expect(all.every((g) => g.slots?.length === 4)).toBe(true);
  });

  it('placeGroup coloca por la base con el alto pedido', () => {
    const g = placeGroup(LIBRARY.find((a) => a.id === 'casa')!.build(), { cx: 500, bottom: 800, height: 300 });
    const b = worldBounds(g);
    close(b.y + b.h, 800, 1e-6);
    close(b.h, 300, 1e-6);
    close(b.x + b.w / 2, 500, 1e-6);
  });

  it('las escenas de partida son válidas y quedan dentro de la hoja', () => {
    for (const t of TEMPLATES) {
      const items = t.build(1920, 1080);
      expect(validateProject(projectWith(items)).ok).toBe(true);
      for (const it of items) {
        const b = worldBounds(it);
        expect(b.x).toBeGreaterThan(-60);
        expect(b.x + b.w).toBeLessThan(1980);
        expect(b.y + b.h).toBeLessThan(1140);
      }
      expect(leafCount(items)).toBeGreaterThan(items.length);
    }
  });
});

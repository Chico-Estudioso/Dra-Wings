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
import { buildExampleProject } from '@core/library/example';
import { evaluateScene } from '@core/render/evaluate';
import { checkReferences, validateProject } from '@core/model/validate';
import type { Group, Item, Project } from '@core/model/types';
import { TICKS_PER_SECOND } from '@core/time/ticks';

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

describe('proyecto de ejemplo', () => {
  // Medida aproximada (en la app se mide con las fuentes reales).
  const measure = (text: string, _font: string, size: number, lineHeight: number) => ({
    w: Math.ceil(text.length * size * 0.5),
    h: Math.ceil(size * lineHeight),
  });

  it('es un proyecto válido de tres escenas que se dibujan en orden', () => {
    const p = buildExampleProject(measure);
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
    expect(checkReferences(p)).toEqual([]);
    expect(p.settings.mode).toBe('guided');
    expect(p.scenes.map((s) => s.name)).toEqual(['Había una vez', 'Un día en la ciudad', 'Ahora tú']);
    // Enseña las novedades: fondos en degradado, letras con contorno y sombra, y un salto en ola.
    expect(p.scenes[0]!.gradient).toBeTruthy();
    expect(p.scenes[2]!.gradient).toBeTruthy();
    const title = p.scenes[2]!.layers[0]!.items!.find((i) => i.type === 'text');
    expect(title).toMatchObject({ outline: { color: '#ffffff' }, shadow: true });
    const jumps = p.scenes[2]!.layers[0]!.items!.filter((i) => i.type === 'group').map((g) => {
      const y = g.transform.y;
      return 'keys' in y ? y.keys[0]!.t : null;
    });
    expect(jumps[1]! - jumps[0]!).toBe(TICKS_PER_SECOND / 4);
    expect(jumps[2]! - jumps[1]!).toBe(TICKS_PER_SECOND / 4);
    for (const s of p.scenes) {
      const items = s.layers[0]!.items!;
      expect(items.length).toBeGreaterThan(1);
      // Tiempo automático: cada elemento empieza cuando termina el anterior.
      for (let i = 1; i < items.length; i++)
        expect(items[i]!.in).toBe(items[i - 1]!.in + items[i - 1]!.enter!.duration);
      const last = items[items.length - 1]!;
      expect(s.duration).toBeGreaterThanOrEqual(last.in + last.enter!.duration);
      expect(items.some((it) => it.type === 'text')).toBe(true);
      // Ritmo de ejemplo: ninguna escena se hace larga.
      expect(s.duration / TICKS_PER_SECOND).toBeLessThan(17);
    }
  });

  it('enseña las novedades: transiciones, textos que se escriben, vida y un personaje que reacciona', () => {
    const p = buildExampleProject(measure);
    const [s1, s2, s3] = p.scenes;
    expect(s2!.transition?.kind).toBe('iris');
    expect(s3!.transition?.kind).toBe('fade');
    const texts = p.scenes.flatMap((s) => s.layers[0]!.items!).filter((i) => i.type === 'text');
    expect(texts.map((t) => t.type === 'text' && t.reveal)).toEqual(['words', 'words', 'bounce', 'words']);
    // Las nubes flotan y el corazón late (vida de la biblioteca).
    const groups = p.scenes.flatMap((s) => s.layers[0]!.items!).filter((i) => i.type === 'group');
    expect(groups.find((g) => g.type === 'group' && g.source?.id === 'nube')?.life?.kind).toBe('float');
    expect(groups.find((g) => g.type === 'group' && g.source?.id === 'corazon')?.life?.kind).toBe('pulse');
    expect(s1!.layers[0]!.items!.some((i) => i.type === 'group' && i.source?.id === 'casa' && !i.life)).toBe(true);
    // Lucía cambia de expresión y salta al terminar el texto.
    const lucia = s2!.layers[0]!.items!.find((i) => i.type === 'group' && i.source?.kind === 'character');
    if (lucia?.type !== 'group') throw new Error('falta Lucía');
    expect(lucia.swaps?.[0]?.variant).toBe('largo/risa/brazos-arriba');
    expect('keys' in lucia.transform.y).toBe(true);
    expect(s2!.duration).toBeGreaterThan(lucia.swaps![0]!.t);
  });

  it('en la primera escena el texto se desvanece y la cámara se acerca a la casa', () => {
    const [s1] = buildExampleProject(measure).scenes;
    const zoom = s1!.camera.scaleX;
    expect('keys' in zoom && zoom.keys.map((k) => k.v)).toEqual([1, 1.5]);
    const items = s1!.layers[0]!.items!;
    const drawn = Math.max(...items.map((it) => it.in + it.enter!.duration));
    const caption = items[items.length - 1]!;
    // Un segundo para leerlo; el zoom empieza cuando el texto ya se ha ido.
    expect('keys' in zoom && zoom.keys[0]!.t).toBe(drawn + TICKS_PER_SECOND);
    expect(caption).toMatchObject({ type: 'text', out: drawn + TICKS_PER_SECOND, exit: { kind: 'fade' } });
    expect(s1!.duration).toBeGreaterThan('keys' in zoom ? zoom.keys[1]!.t : 0);
  });
});

import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createProject, createShape, createStroke, createScene } from '@core/model/factory';
import { addItem, addLayer, celAt, findLayer, locateItem, removeItems, selectableItems } from '@core/edit/ops';
import {
  addScene,
  duplicateScene,
  locateTime,
  moveScene,
  projectDuration,
  removeScene,
  sceneStart,
} from '@core/edit/scenes';
import { appearance, cameraMatrix, evaluateScene, hasCamera, OUTLINE_SHARE } from '@core/render/evaluate';
import { appendTiming, contentEnd, defaultDrawDuration, fitSceneDuration, HOLD_AFTER } from '@core/anim/timing';
import { keyTimes, removeKeyAt, setValueAt, shiftItemTime } from '@core/anim/keyframes';
import { valueAt } from '@core/anim/animated';
import { apply } from '@core/geometry/matrix';
import { makeGroup } from '@core/edit/group';
import { validateProject } from '@core/model/validate';
import { TICKS_PER_SECOND, ticksFromSeconds } from '@core/time/ticks';
import type { Item, Project, Scene } from '@core/model/types';

const S = TICKS_PER_SECOND;
const line = (len = 100) => createStroke([0, 0, -1, 0, len, 0, -1, 10], { color: '#000000', size: 4, opacity: 1 });
const rect = (fill: string | null = '#ff0000') =>
  createShape('rect', 0, 0, 100, 50, { stroke: '#000000', strokeWidth: 4, fill, opacity: 1 });
const sceneWith = (items: Item[]): Scene => {
  const s = createScene('x');
  s.layers[0]!.items = items;
  return s;
};

describe('apariciones', () => {
  it('antes de entrar no se ve; «dibujar» avanza y luego queda completo', () => {
    const it = { ...line(), in: S, enter: { kind: 'draw' as const, duration: 2 * S } };
    expect(appearance(it, 0).visible).toBe(false);
    expect(appearance(it, 2 * S).draw).toBeCloseTo(0.5);
    expect(appearance(it, 10 * S)).toMatchObject({ visible: true, draw: 1, opacity: 1 });
  });

  it('fundido de entrada y de salida, y desaparición en «out»', () => {
    const it = {
      ...line(),
      in: 0,
      out: 4 * S,
      enter: { kind: 'fade' as const, duration: S },
      exit: { kind: 'fade' as const, duration: S },
    };
    expect(appearance(it, S / 2).opacity).toBeCloseTo(0.5);
    expect(appearance(it, 2 * S).opacity).toBe(1);
    expect(appearance(it, 3.5 * S).opacity).toBeCloseTo(0.5);
    expect(appearance(it, 4 * S).visible).toBe(false);
  });

  it('«pop» escala alrededor del ancla', () => {
    const r = { ...rect(), in: 0, enter: { kind: 'pop' as const, duration: S } };
    const early = evaluateScene(sceneWith([r]), S / 10, { mode: 'play' })[0]!;
    const anchor = apply(early.matrix, { x: 50, y: 25 });
    expect(anchor.x).toBeCloseTo(50);
    expect(anchor.y).toBeCloseTo(25);
    expect(Math.abs(early.matrix[0])).toBeLessThan(1);
  });

  it('las formas dibujan el contorno y después el relleno', () => {
    const r = { ...rect(), in: 0, enter: { kind: 'draw' as const, duration: S } };
    const mid = evaluateScene(sceneWith([r]), S * OUTLINE_SHARE * 0.5, { mode: 'play' })[0]!;
    expect(mid.progress).toBeCloseTo(0.5);
    expect(mid.fill).toBe(0);
    const late = evaluateScene(sceneWith([r]), S * (OUTLINE_SHARE + (1 - OUTLINE_SHARE) / 2), { mode: 'play' })[0]!;
    expect(late.progress).toBe(1);
    expect(late.fill).toBeCloseTo(0.5);
  });

  it('un grupo dibuja sus trazos en orden y colorea los rellenos al final', () => {
    const fill = rect();
    fill.style.stroke = null;
    const g = makeGroup([fill, line(100), line(300)]);
    g.in = 0;
    g.enter = { kind: 'draw', duration: S };
    const at = (t: number) => evaluateScene(sceneWith([g]), t, { mode: 'play' });
    // Al 20 % solo se está dibujando el primer trazo (100 de 400 unidades de contorno).
    const early = at(S * OUTLINE_SHARE * 0.2);
    expect(early).toHaveLength(1);
    expect(early[0]!.item.type).toBe('stroke');
    expect(early[0]!.progress).toBeCloseTo(0.8, 1);
    // Antes de la fase de color no hay relleno; durante ella aparece con transparencia.
    expect(at(S * OUTLINE_SHARE * 0.99).some((r) => r.item.type === 'shape')).toBe(false);
    const coloring = at(S * (OUTLINE_SHARE + 0.1));
    expect(coloring.find((r) => r.item.type === 'shape')!.opacity).toBeGreaterThan(0);
    expect(at(S)).toHaveLength(3);
  });

  it('en modo edición todo es visible y completo', () => {
    const it = { ...line(), in: 5 * S, enter: { kind: 'draw' as const, duration: S } };
    expect(evaluateScene(sceneWith([it]), 0, { mode: 'edit' })[0]!.progress).toBe(1);
  });
});

describe('tiempo automático', () => {
  it('cada elemento nuevo empieza al terminar el anterior y la escena se alarga', () => {
    const scene = createScene('x');
    const a = line(500);
    const b = rect();
    for (const it of [a, b]) {
      appendTiming(scene, it);
      scene.layers[0]!.items!.push(it);
    }
    expect(a.in).toBe(0);
    expect(b.in).toBe(a.enter!.duration);
    fitSceneDuration(scene);
    expect(scene.duration).toBe(Math.max(5 * S, contentEnd(scene) + HOLD_AFTER));
  });

  it('las duraciones por defecto están acotadas', () => {
    expect(defaultDrawDuration(line(1))).toBe(ticksFromSeconds(0.25));
    expect(defaultDrawDuration(line(100_000))).toBe(ticksFromSeconds(4));
  });
});

describe('keyframes', () => {
  it('sin grabar cambia el valor; grabando crea la animación desde la entrada', () => {
    expect(setValueAt({ value: 10 }, 2 * S, 50, false, 0)).toEqual({ value: 50 });
    const a = setValueAt({ value: 10 }, 2 * S, 50, true, S);
    expect(a).toMatchObject({
      keys: [
        { t: S, v: 10 },
        { t: 2 * S, v: 50 },
      ],
    });
    expect(valueAt(a, 1.5 * S)).toBeCloseTo(30);
    // Grabar en el instante de entrada o antes no anima.
    expect(setValueAt({ value: 10 }, S, 50, true, S)).toEqual({ value: 50 });
  });

  it('si ya está animado, actualiza o inserta keyframes ordenados', () => {
    let a = setValueAt({ value: 0 }, 2 * S, 100, true, 0);
    a = setValueAt(a, S, 40, false, 0);
    a = setValueAt(a, 2 * S, 80, false, 0);
    expect('keys' in a && a.keys.map((k) => [k.t / S, k.v])).toEqual([
      [0, 0],
      [1, 40],
      [2, 80],
    ]);
    a = removeKeyAt(a, S);
    a = removeKeyAt(a, 0);
    expect(a).toEqual({ value: 80 });
  });

  it('desplazar en el tiempo mueve entrada, salida y keyframes', () => {
    const it = { ...line(), in: S, out: 3 * S };
    it.transform.x = setValueAt(it.transform.x, 2 * S, 10, true, S);
    const moved = produce(it, (d) => shiftItemTime(d, S));
    expect(moved.in).toBe(2 * S);
    expect(moved.out).toBe(4 * S);
    expect(keyTimes(moved)).toEqual([2 * S, 3 * S]);
  });
});

describe('escenas', () => {
  const base = () => createProject({ name: 'p', aspect: 'landscape', fps: 30, mode: 'free' });

  it('añadir, duplicar con ids nuevos, ordenar y eliminar', () => {
    let second = '';
    let copy = '';
    const p0 = base();
    const first = p0.scenes[0]!.id;
    const p = produce(p0, (d: Project) => {
      addItem(d.scenes[0]!, d.scenes[0]!.layers[0]!.id, line());
      second = addScene(d, first); // [1, 2]
      copy = duplicateScene(d, first)!; // [1, copia, 2]
      moveScene(d, second, -1); // [1, 2, copia]
    });
    expect(p.scenes.map((s) => s.id)).toEqual([first, second, copy]);
    expect(p.scenes.find((s) => s.id === copy)!.name).toBe('Escena 1 (copia)');
    const ids = JSON.stringify(p).match(/"id":"[^"]+"/g)!;
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateProject(p).ok).toBe(true);
    const q = produce(p, (d: Project) => {
      removeScene(d, second);
      removeScene(d, copy);
    });
    expect(q.scenes).toHaveLength(1);
    expect(produce(q, (d: Project) => void removeScene(d, d.scenes[0]!.id)).scenes).toHaveLength(1);
  });

  it('tiempo global: inicio de escena, duración total y localización', () => {
    const p = produce(base(), (d: Project) => {
      addScene(d);
      d.scenes[1]!.duration = 3 * S;
    });
    expect(projectDuration(p)).toBe(8 * S);
    expect(sceneStart(p, p.scenes[1]!.id)).toBe(5 * S);
    expect(locateTime(p, 6 * S)).toMatchObject({ scene: { id: p.scenes[1]!.id }, local: S });
    expect(locateTime(p, 100 * S)).toMatchObject({ scene: { id: p.scenes[1]!.id }, local: 3 * S });
  });
});

describe('fotogramas', () => {
  it('dibujar crea fotogramas y solo se ve el del instante', () => {
    const fps30 = S / 30;
    const p = produce(createProject({ name: 'p', aspect: 'landscape', fps: 30, mode: 'free' }), (d: Project) => {
      const sc = d.scenes[0]!;
      const id = addLayer(sc, undefined, 'frames');
      addItem(sc, id, line(), 0, 2 * fps30);
      addItem(sc, id, line(200), 2 * fps30, 2 * fps30);
      addItem(sc, id, line(300), fps30, 2 * fps30); // mismo fotograma que el primero
    });
    const sc = p.scenes[0]!;
    const layer = sc.layers[1]!;
    expect(layer.kind).toBe('frames');
    expect(layer.cels).toHaveLength(2);
    expect(celAt(layer, 0)!.items).toHaveLength(2);
    expect(evaluateScene(sc, 0, { mode: 'play' })).toHaveLength(2);
    expect(evaluateScene(sc, 3 * fps30, { mode: 'edit' })).toHaveLength(1);
    expect(evaluateScene(sc, 10 * fps30, { mode: 'play' })).toHaveLength(0);
    expect(selectableItems(sc, 3 * fps30)).toHaveLength(1);
    const id = celAt(layer, 0)!.items[0]!.id;
    expect(locateItem(sc, id)?.cel).toBe(celAt(layer, 0));
    const q = produce(p, (d: Project) => removeItems(d.scenes[0]!, new Set([id])));
    expect(celAt(findLayer(q.scenes[0]!, layer.id), 0)!.items).toHaveLength(1);
    expect(validateProject(p).ok).toBe(true);
  });
});

describe('cámara', () => {
  it('la matriz lleva el encuadre a la hoja completa', () => {
    const scene = createScene('x');
    expect(hasCamera(scene)).toBe(false);
    scene.camera.x = { value: 100 };
    scene.camera.y = { value: 50 };
    scene.camera.scaleX = { value: 2 };
    scene.camera.scaleY = { value: 2 };
    expect(hasCamera(scene)).toBe(true);
    const m = cameraMatrix(scene, 0);
    expect(apply(m, { x: 100, y: 50 })).toEqual({ x: 0, y: 0 });
    expect(apply(m, { x: 100 + 960, y: 50 + 540 })).toEqual({ x: 1920, y: 1080 });
  });
});

import { describe, expect, it } from 'vitest';
import { transitionAt } from '@core/render/transition';
import { drawSceneInProject, sceneGradient } from '@core/render/frame';
import { PathCache, type Ctx2D } from '@core/render/draw';
import { addScene } from '@core/edit/scenes';
import { createProject } from '@core/model/factory';
import { validateProject } from '@core/model/validate';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;

function twoScenes() {
  const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
  p.settings.boil = 'off';
  p.scenes[0]!.name = 'Uno';
  addScene(p, 'Dos');
  return p;
}

/** Contexto 2D falso: guarda cada relleno de fondo con su opacidad efectiva. */
function fakeCtx() {
  const fills: { alpha: number; style: unknown }[] = [];
  const stack: { globalAlpha: number }[] = [];
  const state = { globalAlpha: 1, fillStyle: '' as unknown };
  const ctx = new Proxy(state as Record<string, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      if (prop === 'save') return () => stack.push({ globalAlpha: state.globalAlpha });
      if (prop === 'restore') return () => Object.assign(state, stack.pop());
      if (prop === 'fillRect') return () => fills.push({ alpha: state.globalAlpha, style: state.fillStyle });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  }) as unknown as Ctx2D;
  return { ctx, fills };
}

describe('transiciones entre escenas', () => {
  it('solo en escenas que no son la primera, y mientras dura', () => {
    const p = twoScenes();
    const [a, b] = p.scenes;
    b!.transition = { kind: 'fade', duration: S };
    a!.transition = { kind: 'fade', duration: S };
    expect(transitionAt(p, a!, 0)).toBeNull();
    expect(transitionAt(p, b!, 0)).toMatchObject({ kind: 'fade', p: 0, prev: { id: a!.id } });
    expect(transitionAt(p, b!, S / 2)!.p).toBeCloseTo(0.5);
    expect(transitionAt(p, b!, S)).toBeNull();
    b!.transition = { kind: 'cut', duration: S };
    expect(transitionAt(p, b!, 0)).toBeNull();
    expect(validateProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });

  it('el fundido dibuja la escena anterior y encima la nueva a medias', () => {
    const p = twoScenes();
    p.scenes[1]!.transition = { kind: 'fade', duration: S };
    const { ctx, fills } = fakeCtx();
    drawSceneInProject(ctx, p, p.scenes[1]!, S / 2, new PathCache());
    // Dos fondos: el de la anterior (opaco) y el de la nueva (a la mitad).
    expect(fills.map((f) => f.alpha)).toEqual([1, 0.5]);
    // Sin transición, un solo fondo opaco.
    const plain = fakeCtx();
    drawSceneInProject(plain.ctx, p, p.scenes[1]!, 2 * S, new PathCache());
    expect(plain.fills.map((f) => f.alpha)).toEqual([1]);
  });

  it('el fundido a blanco pasa por el color de fondo', () => {
    const p = twoScenes();
    p.scenes[1]!.transition = { kind: 'dip', duration: S };
    const { ctx, fills } = fakeCtx();
    drawSceneInProject(ctx, p, p.scenes[1]!, S / 2, new PathCache());
    // Escena (anterior o nueva) y encima el fondo casi opaco en el centro de la transición.
    expect(fills.at(-1)!.alpha).toBeCloseTo(1, 1);
    expect(fills.at(-1)!.style).toBe(p.settings.background);
  });
});

describe('color de fondo por escena', () => {
  it('cada escena pinta su fondo; sin él, el del proyecto', () => {
    const p = twoScenes();
    p.settings.paper = 'plain';
    const [a, b] = p.scenes;
    b!.background = '#fde2e4';
    expect(validateProject(p).ok).toBe(true);
    const first = fakeCtx();
    drawSceneInProject(first.ctx, p, a!, S, new PathCache());
    expect(first.fills[0]!.style).toBe('#ffffff');
    const second = fakeCtx();
    drawSceneInProject(second.ctx, p, b!, S, new PathCache());
    expect(second.fills[0]!.style).toBe('#fde2e4');
  });

  it('el fundido a color pasa por el fondo de la escena que entra', () => {
    const p = twoScenes();
    p.settings.paper = 'plain';
    const b = p.scenes[1]!;
    b.background = '#2b2d42';
    b.transition = { kind: 'dip', duration: S };
    const { ctx, fills } = fakeCtx();
    drawSceneInProject(ctx, p, b, S / 4, new PathCache());
    // Fondo de la escena anterior (blanco) y, encima, el velo del color de la que entra.
    expect(fills.map((f) => f.style)).toEqual(['#ffffff', '#2b2d42']);
  });
});

describe('fondo degradado', () => {
  it('de arriba (el fondo) a abajo (el degradado), a todo el alto de la hoja', () => {
    const p = twoScenes();
    p.settings.paper = 'plain';
    const scene = p.scenes[0]!;
    scene.background = '#fff3b0';
    scene.gradient = '#fde2e4';
    expect(validateProject(p).ok).toBe(true);
    const stops: [number, string][] = [];
    let line: number[] = [];
    const grad = { addColorStop: (o: number, c: string) => stops.push([o, c]) };
    const fills: unknown[] = [];
    const state: Record<string, unknown> = { globalAlpha: 1, fillStyle: '' };
    const ctx = new Proxy(state, {
      get(target, prop) {
        if (prop in target) return target[prop as string];
        if (prop === 'createLinearGradient')
          return (...a: number[]) => {
            line = a;
            return grad;
          };
        if (prop === 'fillRect') return () => fills.push(state.fillStyle);
        return () => undefined;
      },
      set(target, prop, value) {
        target[prop as string] = value;
        return true;
      },
    }) as unknown as Ctx2D;
    drawSceneInProject(ctx, p, scene, 0, new PathCache());
    expect(line).toEqual([0, 0, 0, p.settings.height]);
    expect(stops).toEqual([
      [0, '#fff3b0'],
      [1, '#fde2e4'],
    ]);
    expect(fills[0]).toBe(grad);
  });
});

describe('degradado del proyecto y de cada escena', () => {
  it('la escena usa el del proyecto, el suyo o ninguno (null)', () => {
    expect(sceneGradient({}, {})).toBeNull();
    expect(sceneGradient({ gradient: '#2b2d42' }, {})).toBe('#2b2d42');
    expect(sceneGradient({ gradient: '#2b2d42' }, { gradient: '#fde2e4' })).toBe('#fde2e4');
    expect(sceneGradient({ gradient: '#2b2d42' }, { gradient: null })).toBeNull();
  });
});

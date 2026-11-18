import { describe, expect, it } from 'vitest';
import { drawSceneFrame } from '@core/render/frame';
import { PathCache, type Ctx2D } from '@core/render/draw';
import { createProject, createShape } from '@core/model/factory';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;

/** Contexto falso que cuenta los giros (la mano se dibuja girada; nada más gira aquí). */
function fakeCtx() {
  let rotations = 0;
  const state: Record<string, unknown> = { globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      if (prop === 'rotate') return () => rotations++;
      if (prop === 'measureText') return () => ({ width: 10 });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  }) as unknown as Ctx2D;
  return { ctx, rotations: () => rotations };
}

describe('mano que dibuja en el fotograma', () => {
  const setup = (hand: 'none' | 'marker' | 'pencil') => {
    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    p.settings.boil = 'off';
    p.settings.hand = hand;
    const r = createShape('rect', 100, 100, 300, 200, {
      stroke: '#000000',
      strokeWidth: 6,
      fill: null,
      opacity: 1,
    });
    r.enter = { kind: 'draw', duration: S };
    p.scenes[0]!.layers[0]!.items!.push(r);
    return p;
  };

  it('aparece mientras se dibuja y desaparece al terminar o si está quitada', () => {
    for (const hand of ['marker', 'pencil'] as const) {
      const p = setup(hand);
      const mid = fakeCtx();
      drawSceneFrame(mid.ctx, p.settings, p.scenes[0]!, S / 2, new PathCache());
      expect(mid.rotations()).toBe(1);
      const done = fakeCtx();
      drawSceneFrame(done.ctx, p.settings, p.scenes[0]!, 2 * S, new PathCache());
      expect(done.rotations()).toBe(0);
    }
    const none = setup('none');
    const off = fakeCtx();
    drawSceneFrame(off.ctx, none.settings, none.scenes[0]!, S / 2, new PathCache());
    expect(off.rotations()).toBe(0);
  });
});

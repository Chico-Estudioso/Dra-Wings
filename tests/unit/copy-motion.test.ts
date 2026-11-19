import { describe, expect, it } from 'vitest';
import { copyMotion, hasMotion, pasteMotion, waveStarts } from '@core/anim/copy-motion';
import { createShape } from '@core/model/factory';
import { validateProject } from '@core/model/validate';
import { createProject } from '@core/model/factory';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const style = { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 };

function dancer() {
  const a = createShape('rect', 100, 200, 50, 50, style);
  a.in = S;
  a.transform.x = {
    keys: [
      { t: S, v: 100, ease: 'easeOut' },
      { t: 2 * S, v: 300, ease: 'linear' },
    ],
  };
  a.transform.scaleX = {
    keys: [
      { t: S, v: 1, ease: 'linear' },
      { t: 2 * S, v: 1.5, ease: 'linear' },
    ],
  };
  a.opacity = {
    keys: [
      { t: S, v: 0.5, ease: 'linear' },
      { t: 2 * S, v: 1, ease: 'linear' },
    ],
  };
  a.enter = { kind: 'pop', duration: S / 2 };
  a.out = 4 * S;
  a.exit = { kind: 'fade', duration: S / 2 };
  a.loop = 'pingpong';
  a.life = { kind: 'sway', amount: 1 };
  a.trail = true;
  return a;
}

describe('copiar y pegar animación', () => {
  it('el movimiento se repite desde donde está el destino y desde que aparece', () => {
    const target = createShape('ellipse', 500, 50, 80, 80, style);
    target.in = 3 * S;
    target.transform.scaleX = { value: 2 };
    pasteMotion(target, copyMotion(dancer()));
    expect(target.transform.x).toEqual({
      keys: [
        { t: 3 * S, v: 500, ease: 'easeOut' },
        { t: 4 * S, v: 700, ease: 'linear' },
      ],
    });
    // Escala por factor y opacidad tal cual.
    expect(target.transform.scaleX).toEqual({
      keys: [
        { t: 3 * S, v: 2, ease: 'linear' },
        { t: 4 * S, v: 3, ease: 'linear' },
      ],
    });
    expect(target.opacity).toEqual({
      keys: [
        { t: 3 * S, v: 0.5, ease: 'linear' },
        { t: 4 * S, v: 1, ease: 'linear' },
      ],
    });
    expect(target.transform.y).toEqual({ value: 50 });
    // Aparición, salida (lo mismo después de aparecer), repetición, vida y estela.
    expect(target.enter).toEqual({ kind: 'pop', duration: S / 2 });
    expect(target.out).toBe(6 * S);
    expect(target.exit).toEqual({ kind: 'fade', duration: S / 2 });
    expect(target).toMatchObject({ loop: 'pingpong', life: { kind: 'sway', amount: 1 }, trail: true });

    const p = createProject({ name: 'x', aspect: 'landscape', fps: 30, mode: 'free' });
    p.scenes[0]!.layers[0]!.items!.push(target);
    expect(validateProject(p).ok).toBe(true);
  });

  it('lo que la copia no anima se queda quieto donde está, y lo que no tiene se quita', () => {
    const source = createShape('rect', 0, 0, 10, 10, style);
    source.transform.rotation = {
      keys: [
        { t: 0, v: 0, ease: 'linear' },
        { t: S, v: 90, ease: 'linear' },
      ],
    };
    const target = dancer(); // tenía x, escala, opacidad, salida, vida…
    pasteMotion(target, copyMotion(source));
    expect(target.transform.x).toEqual({ value: 100 });
    expect(target.opacity).toEqual({ value: 0.5 });
    expect(target.transform.rotation).toEqual({
      keys: [
        { t: S, v: 0, ease: 'linear' },
        { t: 2 * S, v: 90, ease: 'linear' },
      ],
    });
    expect(target.out).toBeUndefined();
    expect(target.exit).toBeUndefined();
    expect(target.life).toBeUndefined();
    expect(target.loop).toBeUndefined();
    expect(target.trail).toBeUndefined();
  });

  it('la duración de «Dibujarse» es la de cada dibujo', () => {
    const source = createShape('rect', 0, 0, 10, 10, style);
    source.enter = { kind: 'draw', duration: S };
    expect(hasMotion(copyMotion(source))).toBe(false);
    const target = createShape('rect', 0, 0, 10, 10, style);
    target.enter = { kind: 'draw', duration: 3 * S };
    pasteMotion(target, copyMotion(source));
    expect(target.enter).toEqual({ kind: 'draw', duration: 3 * S });
    const faded = createShape('rect', 0, 0, 10, 10, style);
    faded.enter = { kind: 'fade', duration: S / 4 };
    pasteMotion(faded, copyMotion(source));
    expect(faded.enter).toEqual({ kind: 'draw', duration: S });
  });

  it('las claves que caerían antes del inicio de la escena se juntan en la primera', () => {
    const source = dancer();
    source.in = 2 * S; // sus claves empiezan 1 s antes de aparecer
    const target = createShape('rect', 0, 0, 10, 10, style);
    target.in = 0;
    pasteMotion(target, copyMotion(source));
    const keys = (target.transform.x as { keys: { t: number; v: number }[] }).keys;
    expect(keys.map((k) => k.t)).toEqual([0]);
    expect(keys[0]!.v).toBe(200);
  });
});

describe('pegar en ola', () => {
  it('sin desfase, cada uno cuando aparece', () => {
    expect(waveStarts([0, S, 2 * S], null)).toEqual([0, S, 2 * S]);
  });

  it('en ola, desde que han aparecido todos y a intervalos fijos', () => {
    expect(waveStarts([0, 2 * S, S], { step: S / 4 })).toEqual([2 * S, 2.25 * S, 2.5 * S]);
  });

  it('al ritmo, en los golpes siguientes', () => {
    const beats = [0, 0.5, 1, 1.5, 2, 2.5].map((t, i) => ({ t: t * S, bar: i % 4 === 0 }));
    expect(waveStarts([0, 0.8 * S, 0], { beats })).toEqual([S, 1.5 * S, 2 * S]);
  });

  it('el movimiento pegado empieza en el instante indicado', () => {
    const target = createShape('rect', 500, 50, 80, 80, style);
    pasteMotion(target, copyMotion(dancer()), 2 * S);
    expect((target.transform.x as { keys: { t: number }[] }).keys.map((k) => k.t)).toEqual([2 * S, 3 * S]);
  });
});

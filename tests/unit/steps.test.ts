import { describe, expect, it } from 'vitest';
import { itemSteps, moveBetween, removeStep } from '@core/anim/steps';
import { applyPreset } from '@core/anim/presets';
import { valueAt } from '@core/anim/animated';
import { createShape } from '@core/model/factory';
import { buildCharacter, CHARACTER_PRESETS, setCharacterLook } from '@core/library/character';
import { placeGroup } from '@core/library/place';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const page = { width: 1920, height: 1080 };
const style = { stroke: '#000000', strokeWidth: 4, fill: null, opacity: 1 };

function box() {
  const b = createShape('rect', 400, 300, 100, 100, style);
  b.enter = { kind: 'draw', duration: S };
  return b;
}

const labels = (it: Parameters<typeof itemSteps>[0]) => itemSteps(it).map((s) => s.label);

describe('pasos de un elemento', () => {
  it('sin animación: solo cómo aparece', () => {
    expect(labels(box())).toEqual(['Se dibuja']);
    const b = box();
    b.enter = { kind: 'pop', duration: S / 4 };
    expect(labels(b)).toEqual(['Aparece de golpe']);
  });

  it('las animaciones rápidas se reconocen por lo que hacen', () => {
    const named = (preset: Parameters<typeof applyPreset>[1]) => {
      const b = box();
      applyPreset(b, preset, 2 * S, { page });
      return itemSteps(b).find((s) => s.kind === 'motion');
    };
    expect(named('jump')).toMatchObject({ label: 'Salta', t: 2 * S });
    expect(named('sway')!.label).toBe('Se balancea');
    expect(named('pulse')!.label).toBe('Late');
    expect(named('grow')!.label).toBe('Cambia de tamaño');
  });

  it('de aquí a allí, encadenado: dos pasos de movimiento en orden', () => {
    const b = box();
    b.transform.x = moveBetween(b.transform.x, 2 * S, 3 * S, 900);
    b.transform.x = moveBetween(b.transform.x, 3 * S, 4 * S, 1300);
    const moves = itemSteps(b).filter((s) => s.kind === 'motion');
    // Los dos tramos se tocan: es un solo paso de 2 a 4 s.
    expect(moves).toEqual([expect.objectContaining({ t: 2 * S, end: 4 * S, label: 'Se mueve' })]);
    // Con una pausa entre medias, son dos pasos.
    const c = box();
    c.transform.x = moveBetween(c.transform.x, 2 * S, 3 * S, 900);
    c.transform.x = moveBetween(c.transform.x, 4 * S, 5 * S, 1300);
    expect(
      itemSteps(c)
        .filter((s) => s.kind === 'motion')
        .map((s) => s.t),
    ).toEqual([2 * S, 4 * S]);
  });

  it('quitar un paso de movimiento deja el siguiente igual, desde donde se queda', () => {
    const c = box();
    c.transform.x = moveBetween(c.transform.x, 2 * S, 3 * S, 900); // 400 → 900
    c.transform.x = moveBetween(c.transform.x, 4 * S, 5 * S, 1300); // 900 → 1300 (+400)
    const first = itemSteps(c).find((s) => s.kind === 'motion')!;
    removeStep(c, first);
    // Se queda en 400 hasta los 4 s y luego avanza los mismos 400.
    expect(valueAt(c.transform.x, 3.5 * S)).toBe(400);
    expect(valueAt(c.transform.x, 5 * S)).toBe(800);
    expect(itemSteps(c).filter((s) => s.kind === 'motion')).toHaveLength(1);
  });

  it('pasos continuos y salida, y se pueden quitar', () => {
    const b = box();
    b.life = { kind: 'breathe', amount: 1 };
    b.loop = 'pingpong';
    b.trail = true;
    b.out = 6 * S;
    b.exit = { kind: 'fade', duration: S / 2 };
    const steps = itemSteps(b);
    expect(steps.map((s) => s.label)).toEqual([
      'Se dibuja',
      'Desaparece con un fundido',
      'Respirar',
      'Repite su movimiento yendo y volviendo',
      'Deja estela al moverse',
    ]);
    expect(steps[1]).toMatchObject({ t: 5.5 * S, end: 6 * S });
    for (const s of steps) removeStep(b, s);
    expect(b).toMatchObject({ enter: { kind: 'none' } });
    expect(b.out).toBeUndefined();
    expect(b.life).toBeUndefined();
    expect(b.loop).toBeUndefined();
    expect(b.trail).toBeUndefined();
  });

  it('un personaje: cambios de expresión y hablar con la narración', () => {
    const lucia = CHARACTER_PRESETS.find((c) => c.id === 'lucia')!;
    const g = placeGroup({ ...buildCharacter(lucia.options), name: 'Lucía' }, { cx: 500, bottom: 900, height: 400 });
    g.in = 0;
    setCharacterLook(g, 3 * S, { expression: 'risa', pose: 'brazos-arriba' });
    g.talk = true;
    const steps = itemSteps(g);
    expect(steps.find((s) => s.kind === 'look')).toMatchObject({ t: 3 * S, label: 'Cambia a Risa, brazos arriba' });
    expect(steps.find((s) => s.kind === 'talk')).toMatchObject({ t: null, label: 'Habla con la narración' });
    removeStep(
      g,
      steps.find((s) => s.kind === 'look')!,
    );
    expect(g.swaps).toBeUndefined();
  });
});

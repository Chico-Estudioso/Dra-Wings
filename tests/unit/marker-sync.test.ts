import { describe, expect, it } from 'vitest';
import { addMarker } from '@core/audio/edit';
import { fitScenesToMarkers, markerCuts } from '@core/edit/marker-sync';
import { sceneStart } from '@core/edit/scenes';
import { createProject, createScene, createText } from '@core/model/factory';
import { validateProject } from '@core/model/validate';
import { TICKS_PER_SECOND, ticksPerFrame } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const TEXT = { font: 'hand', size: 60, color: '#000000', align: 'center', lineHeight: 1.2, w: 600, h: 80 } as const;

function song(scenes: number) {
  const p = createProject({ name: 'Canción', aspect: 'landscape', fps: 30, mode: 'free' });
  for (let i = 1; i < scenes; i++) p.scenes.push(createScene(`Frase ${i + 1}`, 5));
  return p;
}

describe('escenas a las marcas', () => {
  it('los cortes caen en fotogramas exactos, ordenados y sin dobles toques', () => {
    const p = song(1);
    addMarker(p, 3.01 * S);
    addMarker(p, 1.5 * S);
    addMarker(p, 1.55 * S); // doble toque: cuenta como el anterior
    addMarker(p, 0.05 * S); // pegado al principio: no es un corte
    const cuts = markerCuts(p);
    expect(cuts).toHaveLength(2);
    expect(cuts[0]).toBe(1.5 * S);
    expect(cuts[1]! % ticksPerFrame(30)).toBe(0);
    expect(Math.abs(cuts[1]! - 3.01 * S)).toBeLessThanOrEqual(ticksPerFrame(30) / 2);
  });

  it('cada escena empieza en su marca', () => {
    const p = song(4);
    for (const t of [2, 3.5, 7]) addMarker(p, t * S);
    const r = fitScenesToMarkers(p);
    expect(r).toEqual({ scenes: 3, sped: 0, unused: 0 });
    expect(p.scenes.map((s) => s.duration / S)).toEqual([2, 1.5, 3.5, 5]); // la última no tiene marca: igual
    expect(sceneStart(p, p.scenes[1]!.id)).toBe(2 * S);
    expect(sceneStart(p, p.scenes[3]!.id)).toBe(7 * S);
    expect(validateProject(p).ok).toBe(true);
  });

  it('una marca de más cierra la última escena y las demás sobran', () => {
    const p = song(2);
    for (const t of [2, 4, 6, 8]) addMarker(p, t * S);
    addMarker(p, 9.01 * S);
    addMarker(p, 9.011 * S); // mismo fotograma que la anterior
    expect(fitScenesToMarkers(p)).toMatchObject({ scenes: 2, unused: 3 });
    expect(p.markers.every((m) => m.t % ticksPerFrame(30) === 0)).toBe(true);
    expect(p.markers).toHaveLength(5);
    expect(p.scenes.map((s) => s.duration / S)).toEqual([2, 2]);
  });

  it('acelera lo que no daba tiempo a escribirse y acorta la transición', () => {
    const p = song(2);
    const text = createText(100, 100, { ...TEXT, text: 'Una frase bastante larga de la canción' });
    text.enter = { kind: 'draw', duration: 3 * S };
    const late = createText(100, 300, { ...TEXT, text: 'Tarde' });
    late.in = 4 * S; // empieza después del corte: no se toca
    late.enter = { kind: 'fade', duration: S };
    p.scenes[1]!.layers[0]!.items!.push(text, late);
    p.scenes[1]!.transition = { kind: 'fade', duration: S };
    addMarker(p, 3 * S);
    addMarker(p, 4.5 * S); // la segunda escena dura 1,5 s
    expect(fitScenesToMarkers(p)).toMatchObject({ scenes: 2, sped: 1 });
    // Termina de escribirse dejando un rato para leerla (1,5 s − 0,375 s).
    expect(text.enter.duration).toBe(1.125 * S);
    expect(late.enter.duration).toBe(S);
    expect(p.scenes[1]!.transition!.duration).toBe(0.75 * S);
  });

  it('sin marcas no cambia nada', () => {
    const p = song(3);
    expect(fitScenesToMarkers(p)).toEqual({ scenes: 0, sped: 0, unused: 0 });
    expect(p.scenes.every((s) => s.duration === 5 * S)).toBe(true);
  });
});

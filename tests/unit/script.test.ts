import { describe, expect, it } from 'vitest';
import { fitText, sceneNameFor, scriptSceneDuration, splitScript, wrapText, writingDuration } from '@core/edit/script';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const measure = (s: string, size = 10) => s.length * size * 0.5;

describe('guion rápido', () => {
  it('trocea en párrafos o líneas, sin vacíos y con espacios limpios', () => {
    const text = 'Había una vez\nuna casa.\n\n\n  Un día  llovió. \r\n\r\nFin';
    expect(splitScript(text, 'paragraph')).toEqual(['Había una vez\nuna casa.', 'Un día llovió.', 'Fin']);
    expect(splitScript(text, 'line')).toEqual(['Había una vez', 'una casa.', 'Un día llovió.', 'Fin']);
    expect(splitScript('   \n\n ', 'paragraph')).toEqual([]);
  });

  it('ajusta las líneas al ancho por palabras', () => {
    // 5 por letra: «uno dos» mide 35, «uno dos tres» 60.
    expect(wrapText('uno dos tres cuatro', 40, (s) => measure(s))).toBe('uno dos\ntres\ncuatro');
    expect(wrapText('supercalifragilístico', 20, (s) => measure(s))).toBe('supercalifragilístico');
    expect(wrapText('a b\nc d', 1000, (s) => measure(s))).toBe('a b\nc d');
  });

  it('elige el tamaño de letra más grande que cabe', () => {
    const short = fitText('Hola', { w: 1000, h: 500 }, 1.2, measure);
    expect(short.size).toBe(110);
    const long = fitText('palabra '.repeat(40).trim(), { w: 1000, h: 300 }, 1.2, measure);
    expect(long.size).toBeLessThan(110);
    const lines = long.text.split('\n');
    expect(lines.length * long.size * 1.2).toBeLessThanOrEqual(300);
    expect(Math.max(...lines.map((l) => measure(l, long.size)))).toBeLessThanOrEqual(1000);
  });

  it('las escenas duran lo que tarda en escribirse y leerse', () => {
    expect(writingDuration('uno dos')).toBe(0.8 * S);
    expect(writingDuration('palabra '.repeat(50))).toBe(6 * S);
    const ten = 'a b c d e f g h i j';
    expect(scriptSceneDuration(ten, false, S / 2)).toBe(Math.round(3 * S + 1.2 * S));
    // Una palabra por golpe a 120 BPM: 10 golpes de medio segundo.
    expect(scriptSceneDuration(ten, true, S / 2)).toBe(Math.round(5 * S + 1.2 * S));
  });

  it('el nombre de la escena es el principio del texto', () => {
    expect(sceneNameFor('Corto')).toBe('Corto');
    expect(sceneNameFor('Un día Lucía se fue a la ciudad con su perro')).toBe('Un día Lucía se fue a la ci…');
  });
});

import { describe, expect, it } from 'vitest';
import { beatWordsProgress, layoutTokens, tokenProgress, wordCount } from '@core/render/text-reveal';
import { appearance } from '@core/render/evaluate';
import { createText } from '@core/model/factory';
import { TICKS_PER_SECOND } from '@core/time/ticks';

const S = TICKS_PER_SECOND;
const measure = (s: string) => s.length * 10;

describe('escritura de textos', () => {
  it('trocea en palabras o letras con su sitio en la línea', () => {
    expect(wordCount('  Hola  mundo\nque tal ')).toBe(4);
    const words = layoutTokens('Hola  mundo\nya', 'words', measure);
    expect(words).toEqual([
      { text: 'Hola', index: 0, x: 0, line: 0 },
      { text: 'mundo', index: 1, x: 60, line: 0 },
      { text: 'ya', index: 2, x: 0, line: 1 },
    ]);
    const letters = layoutTokens('a b', 'letters', measure);
    expect(letters.map((t) => [t.text, t.x])).toEqual([
      ['a', 0],
      ['b', 20],
    ]);
  });

  it('cada pieza entra en su momento', () => {
    // Palabras: la segunda de 4 empieza a la cuarta parte.
    expect(tokenProgress('words', 1, 4, 0.25)).toBe(0);
    expect(tokenProgress('words', 1, 4, 0.375)).toBeCloseTo(0.5);
    // Letras que saltan: se solapan y al final están todas.
    expect(tokenProgress('bounce', 0, 10, 0.1)).toBeGreaterThan(0);
    expect(tokenProgress('bounce', 1, 10, 0.1)).toBeGreaterThan(0);
    expect(tokenProgress('bounce', 9, 10, 0.999)).toBeGreaterThan(0.9);
    expect(tokenProgress('bounce', 9, 10, 1)).toBe(1);
    // Golpes: todo o nada.
    expect(tokenProgress('beat-words', 1, 4, 0.5)).toBe(1);
    expect(tokenProgress('beat-words', 2, 4, 0.5)).toBe(0);
  });

  it('una palabra en cada golpe, desde que entra el texto', () => {
    const t = createText(0, 0, {
      text: 'uno dos tres cuatro',
      font: 'hand',
      size: 40,
      color: '#000000',
      align: 'left',
      lineHeight: 1.2,
      w: 400,
      h: 48,
    });
    t.in = S;
    t.reveal = 'beat-words';
    t.enter = { kind: 'draw', duration: S };
    const beats = [0.5 * S, 1.5 * S, 2 * S, 2.6 * S, 3 * S];
    expect(beatWordsProgress(t, 0.9 * S, beats)).toBe(0);
    expect(beatWordsProgress(t, S, beats)).toBe(0.25);
    expect(beatWordsProgress(t, 1.5 * S, beats)).toBe(0.5);
    expect(beatWordsProgress(t, 2.7 * S, beats)).toBe(1);
    // Sin música: cada medio segundo.
    expect(beatWordsProgress(t, 1.6 * S)).toBe(0.5);
    // La aparición usa ese avance (y no la duración de «Dibujarse»).
    expect(appearance(t, 1.5 * S, beats).draw).toBe(0.5);
    expect(appearance(t, 2.2 * S, beats).draw).toBe(0.75);
  });
});

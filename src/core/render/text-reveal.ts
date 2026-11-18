// Formas de escribir un texto al aparecer (para títulos y letras de canciones): letra a letra,
// palabra a palabra, letras que saltan o una palabra en cada golpe de la música. Puro y sin DOM: el
// dibujo (draw.ts) solo coloca lo que aquí se decide.
import type { TextItem } from '../model/types';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';

export type TextReveal = NonNullable<TextItem['reveal']>;

export const REVEAL_LABELS: Record<TextReveal, string> = {
  letters: 'Letra a letra',
  words: 'Palabra a palabra',
  bounce: 'Letras que saltan',
  'beat-words': 'Una palabra en cada golpe',
};

/** Palabras del texto (sin contar espacios ni saltos de línea). */
export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Avance de «una palabra en cada golpe» en `t`: la primera aparece al entrar el texto y cada golpe
 * siguiente añade otra. Sin golpes, un pulso de 120 BPM.
 */
export function beatWordsProgress(item: TextItem, t: Ticks, beats?: readonly Ticks[]): number {
  const n = wordCount(item.text);
  if (n === 0 || t < item.in) return n === 0 ? 1 : 0;
  let shown = 1;
  if (beats?.length) for (const b of beats) shown += b > item.in && b <= t ? 1 : 0;
  else shown += Math.floor((t - item.in) / (TICKS_PER_SECOND / 2));
  return Math.min(1, shown / n);
}

export interface Token {
  text: string;
  /** Índice de la palabra (para «palabras») o de la letra (para «letras que saltan»). */
  index: number;
  /** Desplazamiento desde el principio de la línea (con la medida de `measure`). */
  x: number;
  line: number;
}

/**
 * Trocea el texto en palabras o letras con su posición en la línea; `measure` da el ancho de un
 * texto con la fuente actual. Los espacios no son piezas, pero sí ocupan su sitio.
 */
export function layoutTokens(text: string, by: 'words' | 'letters', measure: (s: string) => number): Token[] {
  const out: Token[] = [];
  let index = 0;
  text.split('\n').forEach((line, li) => {
    const parts = by === 'words' ? line.split(/(\s+)/) : [...line];
    let prefix = '';
    for (const part of parts) {
      if (part && !/^\s+$/.test(part)) out.push({ text: part, index: index++, x: measure(prefix), line: li });
      prefix += part;
    }
  });
  return out;
}

/** Cuánto ha aparecido la pieza `i` de `n` con el avance `progress` (0..1). */
export function tokenProgress(reveal: TextReveal, i: number, n: number, progress: number): number {
  if (progress >= 1) return 1;
  if (reveal === 'bounce') {
    // Cada letra tarda lo que tres en aparecer; se solapan.
    return Math.max(0, Math.min(1, (progress * (n + 3) - i) / 3));
  }
  if (reveal === 'beat-words') return i < Math.round(progress * n) ? 1 : 0;
  // Palabra a palabra: cada una entra en su tramo.
  return Math.max(0, Math.min(1, progress * n - i));
}

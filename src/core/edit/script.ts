// Guion rápido: un texto (guion de una historia o letra de una canción) se convierte en escenas,
// una por párrafo o por línea, con el texto maquetado (líneas ajustadas al ancho y tamaño de letra
// que quepa) y escribiéndose solo. Puro: medir el texto lo hace quien llama.
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';
import { wordCount } from '../render/text-reveal';

export type ScriptSplit = 'paragraph' | 'line';

/** Bloques del guion: párrafos (separados por líneas en blanco) o líneas, sin vacíos. */
export function splitScript(text: string, by: ScriptSplit): string[] {
  const clean = text.replace(/\r\n?/g, '\n');
  const blocks = by === 'line' ? clean.split('\n') : clean.split(/\n\s*\n/);
  return blocks
    .map((b) =>
      b
        .split('\n')
        .map((l) => l.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean);
}

/** Ajusta cada línea al ancho dado partiendo por palabras (una palabra más larga se queda sola). */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string {
  return text
    .split('\n')
    .map((line) => {
      const out: string[] = [];
      let current = '';
      for (const word of line.split(' ')) {
        const next = current ? `${current} ${word}` : word;
        if (current && measure(next) > maxWidth) {
          out.push(current);
          current = word;
        } else current = next;
      }
      if (current) out.push(current);
      return out.join('\n');
    })
    .join('\n');
}

export interface LaidOutText {
  text: string;
  size: number;
}

/**
 * El tamaño de letra más grande (de `max` a `min`) con el que el texto, ajustado al ancho, cabe en
 * la caja. `measure(s, size)` da el ancho de una línea con ese tamaño.
 */
export function fitText(
  text: string,
  box: { w: number; h: number },
  lineHeight: number,
  measure: (s: string, size: number) => number,
  { max = 110, min = 36 } = {},
): LaidOutText {
  for (let size = max; size >= min; size -= 4) {
    const wrapped = wrapText(text, box.w, (s) => measure(s, size));
    const lines = wrapped.split('\n');
    const widest = Math.max(...lines.map((l) => measure(l, size)));
    if (lines.length * size * lineHeight <= box.h && widest <= box.w) return { text: wrapped, size };
  }
  return { text: wrapText(text, box.w, (s) => measure(s, min)), size: min };
}

/** Lo que tarda en escribirse un texto (sin contar «una palabra en cada golpe»). */
export function writingDuration(text: string): Ticks {
  const s = Math.min(6, Math.max(0.8, wordCount(text) * 0.3));
  return Math.round(s * TICKS_PER_SECOND);
}

/**
 * Duración de la escena: lo que tarda en escribirse (o una palabra por golpe, a `beat` por golpe) y
 * un rato para leerlo con calma.
 */
export function scriptSceneDuration(text: string, beatWords: boolean, beat: Ticks): Ticks {
  const words = wordCount(text);
  const writing = beatWords ? words * beat : writingDuration(text);
  const reading = Math.max(1.2, words * 0.12) * TICKS_PER_SECOND;
  return Math.round(writing + reading);
}

/** Nombre corto de la escena a partir de su texto. */
export function sceneNameFor(text: string): string {
  const flat = text.replace(/\n/g, ' ');
  return flat.length <= 28 ? flat : `${flat.slice(0, 27).trimEnd()}…`;
}

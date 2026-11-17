// Fuentes con licencia OFL empaquetadas con la app: el texto se ve igual en todos los equipos
// y en el vídeo exportado.
import '@fontsource/patrick-hand/400.css';
import '@fontsource/caveat/400.css';
import '@fontsource/nunito/400.css';
import type { FontId } from '@core/model/types';
import { FONT_FAMILIES } from '@core/render/draw';

export const FONT_LABELS: Record<FontId, string> = {
  hand: 'Manuscrita',
  script: 'Caligráfica',
  rounded: 'Redondeada',
};

let ready: Promise<void> | null = null;

export function fontsReady(): Promise<void> {
  ready ??= Promise.all(Object.values(FONT_FAMILIES).map((f) => document.fonts.load(`32px ${f}`).catch(() => []))).then(
    () => undefined,
  );
  return ready;
}

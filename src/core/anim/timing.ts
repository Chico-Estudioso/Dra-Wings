// Tiempos de aparición: valores por defecto y «tiempo automático» (cada elemento nuevo empieza
// cuando termina de dibujarse el anterior, como en un vídeo Draw My Life).
import { POINT_STRIDE } from '../geometry/items';
import type { Item, Scene } from '../model/types';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';
import { shapePerimeterOf } from './perimeter';

const sec = (s: number): Ticks => Math.round(s * TICKS_PER_SECOND);

/** Velocidad de dibujo en unidades de la hoja por segundo (a 1080 px de alto, ~0,9 hojas/s). */
export const DRAW_SPEED = 1000;
export const HOLD_AFTER = sec(1);

function strokeLength(points: number[]): number {
  let len = 0;
  for (let i = POINT_STRIDE; i < points.length; i += POINT_STRIDE)
    len += Math.hypot(points[i]! - points[i - POINT_STRIDE]!, points[i + 1]! - points[i - POINT_STRIDE + 1]!);
  return len;
}

/** Duración razonable de la animación «dibujar» de un elemento. */
export function defaultDrawDuration(item: Item): Ticks {
  const clamp = (s: number, lo: number, hi: number) => sec(Math.min(hi, Math.max(lo, s)));
  switch (item.type) {
    case 'stroke':
      return clamp(strokeLength(item.points) / DRAW_SPEED, 0.25, 4);
    case 'shape':
      return clamp(shapePerimeterOf(item) / DRAW_SPEED + 0.3, 0.4, 3);
    case 'text':
      return clamp([...item.text].length * 0.06, 0.4, 4);
    case 'group':
      return sec(2.5);
    case 'image':
      return sec(1);
  }
}

/** Instante en que termina la última aparición de la escena (o 0 si está vacía). */
export function contentEnd(scene: Scene): Ticks {
  let end = 0;
  for (const layer of scene.layers)
    for (const it of layer.items ?? [])
      end = Math.max(end, it.in + (it.enter && it.enter.kind !== 'none' ? it.enter.duration : 0));
  return end;
}

/** Programa un elemento nuevo al final de lo que ya aparece y le asigna la animación «dibujar». */
export function appendTiming(scene: Scene, item: Item): void {
  item.in = contentEnd(scene);
  item.enter = { kind: item.type === 'image' ? 'fade' : 'draw', duration: defaultDrawDuration(item) };
}

/** Alarga la escena si su contenido termina después de su duración (deja un margen para verlo). */
export function fitSceneDuration(scene: Scene): void {
  const needed = contentEnd(scene) + HOLD_AFTER;
  if (needed > scene.duration) scene.duration = needed;
}

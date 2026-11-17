// Conversión entre coordenadas de pantalla (CSS px del lienzo) y de escena.
import type { Point } from '@core/geometry/matrix';
import type { View } from './editor-store';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;
const FIT_MARGIN = 40;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function toScene(v: View, p: Point): Point {
  return { x: (p.x - v.panX) / v.zoom, y: (p.y - v.panY) / v.zoom };
}

export function toScreen(v: View, p: Point): Point {
  return { x: p.x * v.zoom + v.panX, y: p.y * v.zoom + v.panY };
}

export function fitView(viewW: number, viewH: number, docW: number, docH: number): Omit<View, 'fit'> {
  const zoom = clampZoom(Math.min((viewW - FIT_MARGIN * 2) / docW, (viewH - FIT_MARGIN * 2) / docH));
  return { zoom, panX: (viewW - docW * zoom) / 2, panY: (viewH - docH * zoom) / 2 };
}

/** Zoom manteniendo fijo el punto de pantalla `anchor`. */
export function zoomAt(v: View, factor: number, anchor: Point): View {
  const zoom = clampZoom(v.zoom * factor);
  const k = zoom / v.zoom;
  return { zoom, panX: anchor.x - (anchor.x - v.panX) * k, panY: anchor.y - (anchor.y - v.panY) * k, fit: false };
}

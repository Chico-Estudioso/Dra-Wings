// Ayudas al dibujar a mano alzada: estabilizador («pincel con cuerda») y trazo de tinta (grosor
// según la velocidad y puntas afinadas). Trabajan sobre los puntos empaquetados del trazo
// `[x, y, presión, tMs, ...]` y dejan el resultado guardado en ellos: el trazo es autosuficiente y
// se ve igual en la vista previa y en el vídeo.
import { POINT_STRIDE } from '../geometry/items';
import type { Point } from '../geometry/matrix';

export type StabilizerLevel = 'off' | 'low' | 'medium' | 'high';

export const STABILIZER_LABELS: Record<StabilizerLevel, string> = {
  off: 'Sin',
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};

/** Largo de la «cuerda» en píxeles de pantalla. */
export const STABILIZER_PX: Record<StabilizerLevel, number> = { off: 0, low: 6, medium: 12, high: 22 };

/**
 * Pincel con cuerda: el pincel solo avanza cuando el puntero se aleja más que el radio, y entonces lo
 * sigue a esa distancia. Los temblores pequeños de la mano no llegan al trazo y las curvas salen
 * suaves.
 */
export class LazyBrush {
  private x: number | null = null;
  private y = 0;

  constructor(private readonly radius: number) {}

  /** Nueva posición del pincel, o null si no se ha movido. */
  update(px: number, py: number): Point | null {
    if (this.x === null) {
      this.x = px;
      this.y = py;
      return { x: px, y: py };
    }
    const dx = px - this.x;
    const dy = py - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= this.radius || d === 0) return null;
    const k = (d - this.radius) / d;
    this.x += dx * k;
    this.y += dy * k;
    return { x: this.x, y: this.y };
  }

  /** Al soltar, el trazo llega hasta el puntero: puntos intermedios cada `step` unidades. */
  catchUp(px: number, py: number, step: number): Point[] {
    if (this.x === null) return [];
    const d = Math.hypot(px - this.x, py - this.y);
    const n = Math.ceil(d / Math.max(step, 1e-6));
    const out: Point[] = [];
    for (let i = 1; i <= n; i++) out.push({ x: this.x + ((px - this.x) * i) / n, y: this.y + ((py - this.y) * i) / n });
    return out;
  }
}

/** Longitud de un trazo (unidades de escena). */
export function strokeLength(points: number[]): number {
  let len = 0;
  for (let i = POINT_STRIDE; i < points.length; i += POINT_STRIDE)
    len += Math.hypot(points[i]! - points[i - POINT_STRIDE]!, points[i + 1]! - points[i - POINT_STRIDE + 1]!);
  return len;
}

/**
 * Trazo de tinta para dispositivos sin presión (ratón, táctil): la presión sale de la velocidad
 * (deprisa, más fino; despacio, más grueso), suavizada. `zoom` pasa la velocidad a píxeles de
 * pantalla para que no dependa del acercamiento. Devuelve puntos nuevos; si ya traen presión real
 * (tableta), no se tocan.
 */
export function inkPressures(points: number[], zoom: number): number[] {
  const n = points.length / POINT_STRIDE;
  if (n === 0 || points[2]! >= 0) return points;
  const out = points.slice();
  let p = 0.7;
  for (let i = 0; i < n; i++) {
    const o = i * POINT_STRIDE;
    let target = 0.7;
    if (i > 0) {
      const d = Math.hypot(points[o]! - points[o - POINT_STRIDE]!, points[o + 1]! - points[o - POINT_STRIDE + 1]!);
      const dt = Math.max(1, points[o + 3]! - points[o - POINT_STRIDE + 3]!);
      const speed = (d * zoom) / dt; // píxeles por milisegundo
      target = 0.85 - 0.5 * Math.min(1, speed / 2.5);
    }
    p += (target - p) * (i === 0 ? 1 : 0.25);
    out[o + 2] = Math.round(p * 1000) / 1000;
  }
  return out;
}

/** Ajustes de las ayudas al dibujar (opciones del lápiz). */
export interface DrawAssist {
  stabilizer: StabilizerLevel;
  ink: boolean;
  quickShapes: boolean;
}

export const DEFAULT_ASSIST: DrawAssist = { stabilizer: 'medium', ink: true, quickShapes: true };

/** Puntos y afinado finales de un trazo a mano alzada (con tinta si procede). */
export function finishFreehand(
  points: number[],
  o: { ink: boolean; pen: boolean; zoom: number; size: number },
): { points: number[]; taper?: number } {
  if (!o.ink || o.pen) return { points };
  const inked = inkPressures(points, o.zoom);
  const taper = inkTaper(inked, o.size);
  return taper > 0 ? { points: inked, taper } : { points: inked };
}

/** Puntos empaquetados de una forma limpia: presión uniforme y el tiempo repartido a lo largo. */
export function packShape(shape: Point[], durationMs: number): number[] {
  const n = shape.length;
  return shape.flatMap((p, i) => [p.x, p.y, -1, Math.round((durationMs * i) / Math.max(1, n - 1))]);
}

/** Distancia de afinado de las puntas de un trazo de tinta (unidades de escena). */
export function inkTaper(points: number[], size: number): number {
  return Math.round(Math.min(size * 2.5, strokeLength(points) * 0.22) * 100) / 100;
}

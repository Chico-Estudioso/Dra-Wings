// Matrices afines 2D con el mismo convenio que DOMMatrix / CanvasRenderingContext2D.setTransform:
// x' = a·x + c·y + e ; y' = b·x + d·y + f
import { valueAt } from '../anim/animated';
import type { Transform } from '../model/types';
import type { Ticks } from '../time/ticks';

export type Mat = readonly [a: number, b: number, c: number, d: number, e: number, f: number];
export interface Point {
  x: number;
  y: number;
}

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function multiply(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy: number): Mat => [sx, 0, 0, sy, 0, 0];
export function rotateDeg(deg: number): Mat {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return IDENTITY;
  const id = 1 / det;
  return [
    m[3] * id,
    -m[1] * id,
    -m[2] * id,
    m[0] * id,
    (m[2] * m[5] - m[3] * m[4]) * id,
    (m[1] * m[4] - m[0] * m[5]) * id,
  ];
}

export function apply(m: Mat, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** Factor de escala medio (para convertir distancias entre espacios). */
export function meanScale(m: Mat): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
}

export interface StaticTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  anchorX: number;
  anchorY: number;
}

export function resolveTransform(t: Transform, tick: Ticks): StaticTransform {
  return {
    x: valueAt(t.x, tick),
    y: valueAt(t.y, tick),
    scaleX: valueAt(t.scaleX, tick),
    scaleY: valueAt(t.scaleY, tick),
    rotation: valueAt(t.rotation, tick),
    anchorX: t.anchorX,
    anchorY: t.anchorY,
  };
}

/** T(x + ax, y + ay) · R(rot) · S(sx, sy) · T(-ax, -ay) */
export function matrixFrom(t: StaticTransform): Mat {
  return multiply(
    multiply(multiply(translate(t.x + t.anchorX, t.y + t.anchorY), rotateDeg(t.rotation)), scale(t.scaleX, t.scaleY)),
    translate(-t.anchorX, -t.anchorY),
  );
}

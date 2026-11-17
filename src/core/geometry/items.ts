// Cajas, esquinas y detección de impacto de los elementos, en espacio local y de escena.
import type { Item, Shape, Stroke } from '../model/types';
import { apply, invert, matrixFrom, meanScale, resolveTransform, type Mat, type Point } from './matrix';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const POINT_STRIDE = 4; // [x, y, presión, tMs]

export function arrowHeadSize(strokeWidth: number): number {
  return Math.max(12, strokeWidth * 3.5);
}

/** Caja local sin transformar, incluido el grosor del trazo. */
export function localBounds(item: Item): Rect {
  switch (item.type) {
    case 'stroke': {
      const p = item.points;
      if (p.length < POINT_STRIDE) return { x: 0, y: 0, w: 0, h: 0 };
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < p.length; i += POINT_STRIDE) {
        const x = p[i]!;
        const y = p[i + 1]!;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
      const r = item.style.size / 2;
      return { x: x0 - r, y: y0 - r, w: x1 - x0 + 2 * r, h: y1 - y0 + 2 * r };
    }
    case 'shape': {
      const pad = item.style.stroke ? item.style.strokeWidth / 2 : 0;
      const extra = item.shape === 'arrow' ? arrowHeadSize(item.style.strokeWidth) / 2 : 0;
      const x0 = Math.min(0, item.w);
      const y0 = Math.min(0, item.h);
      const m = pad + extra;
      return { x: x0 - m, y: y0 - m, w: Math.abs(item.w) + 2 * m, h: Math.abs(item.h) + 2 * m };
    }
    case 'text':
    case 'group':
      return { x: 0, y: 0, w: item.w, h: item.h };
  }
}

export function itemMatrix(item: Item, tick = 0): Mat {
  return matrixFrom(resolveTransform(item.transform, tick));
}

export function rectCorners(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

/** Esquinas de la caja orientada del elemento en coordenadas de escena. */
export function worldCorners(item: Item, tick = 0, m = itemMatrix(item, tick)): Point[] {
  return rectCorners(localBounds(item)).map((p) => apply(m, p));
}

export function boundsOfPoints(points: Point[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return points.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
}

export function worldBounds(item: Item, tick = 0, m?: Mat): Rect {
  return boundsOfPoints(worldCorners(item, tick, m));
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return boundsOfPoints(rects.flatMap(rectCorners));
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hitStroke(s: Stroke, p: Point, tol: number): boolean {
  const pts = s.points;
  const r = s.style.size / 2 + tol;
  if (pts.length === POINT_STRIDE) return Math.hypot(p.x - pts[0]!, p.y - pts[1]!) <= r;
  for (let i = POINT_STRIDE; i < pts.length; i += POINT_STRIDE) {
    const a = { x: pts[i - POINT_STRIDE]!, y: pts[i - POINT_STRIDE + 1]! };
    const b = { x: pts[i]!, y: pts[i + 1]! };
    if (distToSegment(p, a, b) <= r) return true;
  }
  return false;
}

export function pointInPolygon(p: Point, pts: number[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i]!;
    const yi = pts[i + 1]!;
    const xj = pts[j]!;
    const yj = pts[j + 1]!;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function hitShape(s: Shape, p: Point, tol: number): boolean {
  const half = (s.style.stroke ? s.style.strokeWidth / 2 : 0) + tol;
  if (s.shape === 'line' || s.shape === 'arrow') return distToSegment(p, { x: 0, y: 0 }, { x: s.w, y: s.h }) <= half;
  if (s.shape === 'polygon') {
    const pts = s.points ?? [];
    if (s.style.fill && pointInPolygon(p, pts)) return true;
    for (let i = 0; i < pts.length; i += 2) {
      const j = (i + 2) % pts.length;
      if (distToSegment(p, { x: pts[i]!, y: pts[i + 1]! }, { x: pts[j]!, y: pts[j + 1]! }) <= half) return true;
    }
    return false;
  }
  const x0 = Math.min(0, s.w);
  const y0 = Math.min(0, s.h);
  const w = Math.abs(s.w);
  const h = Math.abs(s.h);
  if (s.shape === 'rect') {
    const inside = p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h;
    if (inside && s.style.fill) return true;
    const outer = p.x >= x0 - half && p.x <= x0 + w + half && p.y >= y0 - half && p.y <= y0 + h + half;
    const inner = p.x > x0 + half && p.x < x0 + w - half && p.y > y0 + half && p.y < y0 + h - half;
    return outer && !inner;
  }
  // Elipse: distancia radial normalizada.
  const rx = w / 2;
  const ry = h / 2;
  const nx = (p.x - (x0 + rx)) / Math.max(rx, 1e-6);
  const ny = (p.y - (y0 + ry)) / Math.max(ry, 1e-6);
  const d = Math.hypot(nx, ny);
  if (d <= 1 && s.style.fill) return true;
  const band = half / Math.max(Math.min(rx, ry), 1e-6);
  return Math.abs(d - 1) <= band;
}

/** ¿El punto de escena `p` toca el elemento? `tol` en unidades de escena. */
export function hitItem(item: Item, p: Point, tol: number, tick = 0): boolean {
  const m = itemMatrix(item, tick);
  const local = apply(invert(m), p);
  const localTol = tol / meanScale(m);
  switch (item.type) {
    case 'stroke':
      return hitStroke(item, local, localTol);
    case 'shape':
      return hitShape(item, local, localTol);
    case 'text': {
      const b = localBounds(item);
      return (
        local.x >= b.x - localTol &&
        local.x <= b.x + b.w + localTol &&
        local.y >= b.y - localTol &&
        local.y <= b.y + b.h + localTol
      );
    }
    case 'group':
      // Un grupo se toca si se toca alguno de sus elementos (no su caja vacía).
      return item.children.some((child) => hitItem(child, local, localTol, tick));
  }
}

/** Caja de un conjunto de elementos en el espacio de su contenedor. */
export function itemsBounds(items: Item[], tick = 0): Rect | null {
  return unionRects(items.map((i) => worldBounds(i, tick)));
}

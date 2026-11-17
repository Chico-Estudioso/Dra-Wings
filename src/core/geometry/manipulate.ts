// Cálculo de transformaciones al redimensionar o rotar con los tiradores de selección.
import type { Item } from '../model/types';
import { localBounds, type Rect } from './items';
import { apply, matrixFrom, type Point, type StaticTransform } from './matrix';

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const HANDLE_UV: Record<Handle, readonly [number, number]> = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
};

const MIN_SCALE = 0.02;

function rotate(p: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function clampScale(next: number, prev: number): number {
  const sign = Math.sign(prev) || 1;
  return Math.sign(next) === sign ? sign * Math.max(MIN_SCALE, Math.abs(next)) : sign * MIN_SCALE;
}

function placeAnchor(
  t: StaticTransform,
  sx: number,
  sy: number,
  localFixed: Point,
  worldFixed: Point,
): StaticTransform {
  // Posición tal que el punto local fijo siga en la misma posición de escena.
  const v = rotate({ x: (localFixed.x - t.anchorX) * sx, y: (localFixed.y - t.anchorY) * sy }, t.rotation);
  return { ...t, scaleX: sx, scaleY: sy, x: worldFixed.x - v.x - t.anchorX, y: worldFixed.y - v.y - t.anchorY };
}

/** Redimensiona un elemento con un tirador de su caja orientada; el tirador opuesto queda fijo. */
export function resizeSingle(item: Item, t0: StaticTransform, handle: Handle, pointer: Point, keepAspect: boolean) {
  const b = localBounds(item);
  const [hu, hv] = HANDLE_UV[handle];
  const fixedLocal = { x: b.x + (1 - hu) * b.w, y: b.y + (1 - hv) * b.h };
  const handleLocal = { x: b.x + hu * b.w, y: b.y + hv * b.h };
  const fixedWorld = apply(matrixFrom(t0), fixedLocal);
  const v = rotate({ x: pointer.x - fixedWorld.x, y: pointer.y - fixedWorld.y }, -t0.rotation);
  const d = { x: handleLocal.x - fixedLocal.x, y: handleLocal.y - fixedLocal.y };
  const affectsX = hu !== 0.5 && Math.abs(d.x) > 1e-6;
  const affectsY = hv !== 0.5 && Math.abs(d.y) > 1e-6;
  let sx = affectsX ? clampScale(v.x / d.x, t0.scaleX) : t0.scaleX;
  let sy = affectsY ? clampScale(v.y / d.y, t0.scaleY) : t0.scaleY;
  if (keepAspect) {
    const rx = sx / t0.scaleX;
    const ry = sy / t0.scaleY;
    const r = affectsX && affectsY ? Math.max(rx, ry) : affectsX ? rx : ry;
    sx = t0.scaleX * r;
    sy = t0.scaleY * r;
  }
  return placeAnchor(t0, sx, sy, fixedLocal, fixedWorld);
}

/** Escala uniforme de varios elementos respecto a la esquina o lado opuesto de su caja común. */
export function resizeGroup(
  transforms: StaticTransform[],
  box: Rect,
  handle: Handle,
  pointer: Point,
): StaticTransform[] {
  const [hu, hv] = HANDLE_UV[handle];
  const fixed = { x: box.x + (1 - hu) * box.w, y: box.y + (1 - hv) * box.h };
  const h = { x: box.x + hu * box.w, y: box.y + hv * box.h };
  let s: number;
  if (hu !== 0.5 && hv !== 0.5) {
    const dx = h.x - fixed.x;
    const dy = h.y - fixed.y;
    s = ((pointer.x - fixed.x) * dx + (pointer.y - fixed.y) * dy) / (dx * dx + dy * dy || 1);
  } else if (hu !== 0.5) s = (pointer.x - fixed.x) / (h.x - fixed.x || 1);
  else s = (pointer.y - fixed.y) / (h.y - fixed.y || 1);
  s = Math.max(MIN_SCALE, s);
  return transforms.map((t) => {
    const ax = t.x + t.anchorX;
    const ay = t.y + t.anchorY;
    return {
      ...t,
      scaleX: t.scaleX * s,
      scaleY: t.scaleY * s,
      x: fixed.x + s * (ax - fixed.x) - t.anchorX,
      y: fixed.y + s * (ay - fixed.y) - t.anchorY,
    };
  });
}

/** Rota elementos `angleDeg` grados alrededor del punto de escena `center`. */
export function rotateGroup(transforms: StaticTransform[], center: Point, angleDeg: number): StaticTransform[] {
  return transforms.map((t) => {
    const a = rotate({ x: t.x + t.anchorX - center.x, y: t.y + t.anchorY - center.y }, angleDeg);
    return { ...t, rotation: t.rotation + angleDeg, x: center.x + a.x - t.anchorX, y: center.y + a.y - t.anchorY };
  });
}

export function snapAngle(deg: number, step = 15): number {
  return Math.round(deg / step) * step;
}

// Geometría de la selección en pantalla: caja, tiradores y punto de rotación.
import { HANDLE_UV, type Handle } from '@core/geometry/manipulate';
import { localBounds, unionRects, worldBounds, type Rect } from '@core/geometry/items';
import { apply, matrixFrom, resolveTransform, type Point, type StaticTransform } from '@core/geometry/matrix';
import { locateItem } from '@core/edit/ops';
import type { Item, Scene } from '@core/model/types';

export interface SelectionGeometry {
  items: Item[];
  /** Esquinas (escena) de la caja: orientada si hay un solo elemento, alineada a los ejes si hay varios. */
  corners: Point[];
  box: Rect;
  single: boolean;
  center: Point;
}

export function transformOf(item: Item, overrides?: ReadonlyMap<string, StaticTransform>): StaticTransform {
  return overrides?.get(item.id) ?? resolveTransform(item.transform, 0);
}

export function selectionGeometry(
  scene: Scene,
  ids: string[],
  overrides?: ReadonlyMap<string, StaticTransform>,
): SelectionGeometry | null {
  const items = ids.map((id) => locateItem(scene, id)?.item).filter((i): i is Item => !!i);
  if (items.length === 0) return null;
  if (items.length === 1) {
    const item = items[0]!;
    const t = transformOf(item, overrides);
    const m = matrixFrom(t);
    const b = localBounds(item);
    const corners = [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
      { x: b.x, y: b.y + b.h },
    ].map((p) => apply(m, p));
    return {
      items,
      corners,
      box: worldBounds(item, 0, m),
      single: true,
      center: { x: t.x + t.anchorX, y: t.y + t.anchorY },
    };
  }
  const box = unionRects(items.map((i) => worldBounds(i, 0, matrixFrom(transformOf(i, overrides)))))!;
  return {
    items,
    corners: [
      { x: box.x, y: box.y },
      { x: box.x + box.w, y: box.y },
      { x: box.x + box.w, y: box.y + box.h },
      { x: box.x, y: box.y + box.h },
    ],
    box,
    single: false,
    center: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
  };
}

/** Posición de un tirador interpolando las esquinas (sirve para cajas orientadas). */
export function handlePoint(corners: Point[], handle: Handle): Point {
  const [u, v] = HANDLE_UV[handle];
  const [a, b, c, d] = corners as [Point, Point, Point, Point];
  const top = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  const bottom = { x: d.x + (c.x - d.x) * u, y: d.y + (c.y - d.y) * u };
  return { x: top.x + (bottom.x - top.x) * v, y: top.y + (bottom.y - top.y) * v };
}

/** Tirador de rotación: por encima del centro del borde superior, a `distance` px de pantalla. */
export function rotateHandlePoint(corners: Point[], distanceScene: number): Point {
  const top = handlePoint(corners, 'n');
  const bottom = handlePoint(corners, 's');
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: top.x + (dx / len) * distanceScene, y: top.y + (dy / len) * distanceScene };
}

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function cursorForHandle(handle: Handle, rotationDeg: number): string {
  const base: Record<Handle, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
  const a = (((base[handle] + rotationDeg) % 180) + 180) % 180;
  if (a < 22.5 || a >= 157.5) return 'ew-resize';
  if (a < 67.5) return 'nwse-resize';
  if (a < 112.5) return 'ns-resize';
  return 'nesw-resize';
}

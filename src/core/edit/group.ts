// Agrupar, desagrupar y recolorear grupos (recursos de biblioteca y agrupaciones del usuario).
import { fixed, offset } from '../anim/animated';
import { identityTransform, newId } from '../model/factory';
import type { ColorSlot, Group, Item, Scene } from '../model/types';
import { itemMatrix, itemsBounds, POINT_STRIDE } from '../geometry/items';
import { apply, matrixFrom, meanScale, multiply, resolveTransform, type Mat } from '../geometry/matrix';
import { deepClone } from './clone';
import { locateItem } from './ops';

/** Desplaza un elemento en el espacio de su contenedor. */
export function shiftItem(item: Item, dx: number, dy: number): void {
  item.transform.x = offset(item.transform.x, dx);
  item.transform.y = offset(item.transform.y, dy);
}

/**
 * Construye un grupo con los elementos dados (en coordenadas del contenedor): calcula su caja,
 * lleva los hijos a coordenadas locales (origen en la esquina) y coloca el grupo donde estaban.
 */
export function makeGroup(children: Item[], extra: Partial<Pick<Group, 'name' | 'source' | 'slots'>> = {}): Group {
  const b = itemsBounds(children) ?? { x: 0, y: 0, w: 0, h: 0 };
  for (const c of children) shiftItem(c, -b.x, -b.y);
  const t = identityTransform(b.x, b.y);
  t.anchorX = b.w / 2;
  t.anchorY = b.h / 2;
  return {
    id: newId(),
    type: 'group',
    transform: t,
    opacity: fixed(1),
    in: 0,
    children,
    w: b.w,
    h: b.h,
    ...extra,
  };
}

/** Agrupa elementos de una misma lista (capa o fotograma) en la posición del más alto. */
export function groupItems(scene: Scene, ids: string[]): string | null {
  const locs = ids.map((id) => locateItem(scene, id)).filter((l): l is NonNullable<typeof l> => !!l);
  if (locs.length < 2) return null;
  const list = locs[0]!.list;
  if (locs.some((l) => l.list !== list)) return null;
  const set = new Set(ids);
  const ordered = list.filter((i) => set.has(i.id));
  const topIndex = Math.max(...locs.map((l) => l.index));
  const group = makeGroup(ordered.map((i) => deepClone(i)));
  const remaining = list.filter((i) => !set.has(i.id));
  remaining.splice(topIndex - (ordered.length - 1), 0, group);
  list.splice(0, list.length, ...remaining);
  return group.id;
}

/** Descompone una matriz sin sesgo en traslación, rotación (grados) y escala. */
function decompose(m: Mat) {
  const scaleX = Math.hypot(m[0], m[1]);
  const rotation = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  const det = m[0] * m[3] - m[1] * m[2];
  return { scaleX, scaleY: scaleX ? det / scaleX : 1, rotation };
}

/** Lleva un elemento hijo al espacio del contenedor del grupo aplicándole la matriz del grupo. */
function bake(child: Item, groupMatrix: Mat): Item {
  const world = multiply(groupMatrix, itemMatrix(child));
  if (child.type === 'stroke') {
    // Los trazos absorben cualquier transformación en sus puntos (exacto) y escalan su grosor.
    const pts = child.points.slice();
    for (let i = 0; i < pts.length; i += POINT_STRIDE) {
      const p = apply(world, { x: pts[i]!, y: pts[i + 1]! });
      pts[i] = p.x;
      pts[i + 1] = p.y;
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < pts.length; i += POINT_STRIDE) {
      x0 = Math.min(x0, pts[i]!);
      x1 = Math.max(x1, pts[i]!);
      y0 = Math.min(y0, pts[i + 1]!);
      y1 = Math.max(y1, pts[i + 1]!);
    }
    const t = identityTransform();
    t.anchorX = (x0 + x1) / 2;
    t.anchorY = (y0 + y1) / 2;
    return {
      ...child,
      points: pts,
      transform: t,
      style: { ...child.style, size: child.style.size * meanScale(world) },
    };
  }
  // Resto: rotación y escala (sin sesgo) conservando el ancla del elemento.
  const { scaleX, scaleY, rotation } = decompose(world);
  const { anchorX, anchorY } = child.transform;
  const w = apply(world, { x: anchorX, y: anchorY });
  return {
    ...child,
    transform: {
      x: fixed(w.x - anchorX),
      y: fixed(w.y - anchorY),
      scaleX: fixed(scaleX),
      scaleY: fixed(scaleY),
      rotation: fixed(rotation),
      anchorX,
      anchorY,
    },
  };
}

/** Sustituye un grupo por sus elementos, conservando su aspecto. Devuelve los ids resultantes. */
export function ungroupItem(scene: Scene, id: string): string[] {
  const loc = locateItem(scene, id);
  if (!loc || loc.item.type !== 'group') return [];
  const g = loc.item;
  const gm = matrixFrom(resolveTransform(g.transform, 0));
  const groupOpacity = 'value' in g.opacity ? g.opacity.value : 1;
  const children = g.children.map((c) => {
    const baked = bake(deepClone(c), gm);
    if (groupOpacity !== 1 && 'value' in baked.opacity) baked.opacity = fixed(baked.opacity.value * groupOpacity);
    return baked;
  });
  loc.list.splice(loc.index, 1, ...children);
  return children.map((c) => c.id);
}

function recolorItem(item: Item, slot: string, color: string): void {
  if (item.type === 'group') {
    for (const c of item.children) recolorItem(c, slot, color);
    return;
  }
  if (item.slot !== slot) return;
  if (item.type === 'stroke') item.style.color = color;
  else if (item.type === 'text') item.color = color;
  else if (item.type === 'shape') {
    if (item.style.fill !== null) item.style.fill = color;
    else item.style.stroke = color;
  }
}

/** Cambia el color de una ranura (piel, pelo, ropa…) en todo el grupo. */
export function recolorSlot(group: Group, slotId: string, color: string): void {
  const slot = group.slots?.find((s: ColorSlot) => s.id === slotId);
  if (slot) slot.color = color;
  for (const c of group.children) recolorItem(c, slotId, color);
}

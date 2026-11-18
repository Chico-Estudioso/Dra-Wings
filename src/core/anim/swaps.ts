// Cambios de dibujo de un grupo en el tiempo: desde cada instante, el grupo se dibuja con otros
// hijos (por ejemplo, un personaje que cambia de expresión o de postura). El grupo sigue siendo un
// solo elemento: se mueve, anima y selecciona entero.
import type { Group, Item } from '../model/types';
import type { Ticks } from '../time/ticks';

/** Hijos que se ven en `t`: los del último cambio ya empezado o, si no hay, los originales. */
export function childrenAt(group: Group, t: Ticks): Item[] {
  let children = group.children;
  for (const s of group.swaps ?? []) {
    if (s.t > t) break;
    children = s.children;
  }
  return children;
}

/** Todas las listas de hijos del grupo (la original y la de cada cambio). */
export function childLists(group: Group): Item[][] {
  return [group.children, ...(group.swaps ?? []).map((s) => s.children)];
}

/** Aspecto (`variant`) que se ve en `t`; el original es el de `source`. */
export function variantAt(group: Group, t: Ticks): string | undefined {
  let v = group.source?.id;
  for (const s of group.swaps ?? []) {
    if (s.t > t) break;
    v = s.variant ?? v;
  }
  return v;
}

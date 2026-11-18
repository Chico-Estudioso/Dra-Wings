// Operaciones puras sobre escenas (se usan dentro de recetas Immer; mutan el borrador recibido).
// Una capa vectorial tiene una lista de elementos; una capa de fotogramas, una lista por fotograma (cel).
import { childLists } from '../anim/swaps';
import { offset } from '../anim/animated';
import { deepClone } from './clone';
import { createLayer, newId } from '../model/factory';
import type { Cel, Item, Layer, Project, Scene } from '../model/types';
import type { Ticks } from '../time/ticks';

export function findScene(project: Project, sceneId: string): Scene {
  const s = project.scenes.find((x) => x.id === sceneId);
  if (!s) throw new Error(`Escena no encontrada: ${sceneId}`);
  return s;
}

export function findLayer(scene: Scene, layerId: string): Layer {
  const l = scene.layers.find((x) => x.id === layerId);
  if (!l) throw new Error(`Capa no encontrada: ${layerId}`);
  return l;
}

/** Todas las listas de elementos de una capa (una por fotograma en las capas de fotogramas). */
export function itemLists(layer: Layer): Item[][] {
  return layer.kind === 'frames' ? (layer.cels ?? []).map((c) => c.items) : layer.items ? [layer.items] : [];
}

/** Fotograma visible en el instante `t` (el que lo contiene). */
export function celAt(layer: Layer, t: Ticks): Cel | null {
  return (layer.cels ?? []).find((c) => t >= c.start && t < c.start + c.duration) ?? null;
}

/** Elementos visibles de una capa en el instante `t`. */
export function layerItemsAt(layer: Layer, t: Ticks): Item[] {
  return layer.kind === 'frames' ? (celAt(layer, t)?.items ?? []) : (layer.items ?? []);
}

export interface ItemLocation {
  layer: Layer;
  list: Item[];
  index: number;
  item: Item;
  cel: Cel | null;
}

export function locateItem(scene: Scene, id: string): ItemLocation | null {
  for (const layer of scene.layers) {
    if (layer.kind === 'frames') {
      for (const cel of layer.cels ?? []) {
        const index = cel.items.findIndex((i) => i.id === id);
        if (index >= 0) return { layer, list: cel.items, index, item: cel.items[index]!, cel };
      }
    } else if (layer.items) {
      const index = layer.items.findIndex((i) => i.id === id);
      if (index >= 0) return { layer, list: layer.items, index, item: layer.items[index]!, cel: null };
    }
  }
  return null;
}

/**
 * Añade un elemento a una capa. En una capa de fotogramas va al fotograma de `t`; si no hay
 * ninguno, se crea uno que empieza en `t` y dura `celDuration`.
 */
export function addItem(scene: Scene, layerId: string, item: Item, t: Ticks = 0, celDuration?: Ticks): void {
  const layer = findLayer(scene, layerId);
  if (layer.kind === 'frames') {
    layer.cels ??= [];
    let cel = celAt(layer, t);
    if (!cel) {
      cel = { id: newId(), start: t, duration: celDuration ?? 1, items: [] };
      layer.cels.push(cel);
      layer.cels.sort((a, b) => a.start - b.start);
    }
    cel.items.push(item);
    return;
  }
  if (!layer.items) throw new Error('La capa no admite elementos vectoriales');
  layer.items.push(item);
}

function removeFromList(list: Item[], ids: ReadonlySet<string>) {
  for (let i = list.length - 1; i >= 0; i--) if (ids.has(list[i]!.id)) list.splice(i, 1);
}

export function removeItems(scene: Scene, ids: ReadonlySet<string>): void {
  for (const layer of scene.layers) for (const list of itemLists(layer)) removeFromList(list, ids);
}

/** Sustituye un elemento por otros (por ejemplo, un trazo dividido por la goma) en su misma posición. */
export function replaceItem(scene: Scene, id: string, replacements: Item[]): void {
  const loc = locateItem(scene, id);
  if (loc) loc.list.splice(loc.index, 1, ...replacements);
}

export function updateItem<T extends Item>(scene: Scene, id: string, fn: (item: T) => void): void {
  const loc = locateItem(scene, id);
  if (loc) fn(loc.item as T);
}

export function translateItems(scene: Scene, ids: Iterable<string>, dx: number, dy: number): void {
  for (const id of ids) {
    const loc = locateItem(scene, id);
    if (!loc) continue;
    loc.item.transform.x = offset(loc.item.transform.x, dx);
    loc.item.transform.y = offset(loc.item.transform.y, dy);
  }
}

/** Duplica elementos justo encima de cada original. Devuelve los nuevos ids en el mismo orden. */
export function duplicateItems(scene: Scene, ids: string[], dx = 24, dy = 24): string[] {
  const created: string[] = [];
  for (const id of ids) {
    const loc = locateItem(scene, id);
    if (!loc) continue;
    const copy = withNewIds(deepClone(loc.item));
    copy.transform.x = offset(copy.transform.x, dx);
    copy.transform.y = offset(copy.transform.y, dy);
    loc.list.splice(loc.index + 1, 0, copy);
    created.push(copy.id);
  }
  return created;
}

/** Asigna ids nuevos a un elemento y a todo su contenido (para copias). */
export function withNewIds<T extends Item>(item: T): T {
  item.id = newId();
  if (item.type === 'group') childLists(item).forEach((list) => list.forEach((c) => withNewIds(c)));
  return item;
}

export type ZMove = 'forward' | 'backward' | 'front' | 'back';

/** Cambia el orden de apilado dentro de cada lista. */
export function reorderItems(scene: Scene, ids: ReadonlySet<string>, move: ZMove): void {
  for (const layer of scene.layers)
    for (const items of itemLists(layer)) {
      if (!items.some((i) => ids.has(i.id))) continue;
      const sel = items.filter((i) => ids.has(i.id));
      const rest = items.filter((i) => !ids.has(i.id));
      if (move === 'front' || move === 'back') {
        items.splice(0, items.length, ...(move === 'front' ? [...rest, ...sel] : [...sel, ...rest]));
      } else if (move === 'forward') {
        for (let i = items.length - 2; i >= 0; i--)
          if (ids.has(items[i]!.id) && !ids.has(items[i + 1]!.id))
            [items[i], items[i + 1]] = [items[i + 1]!, items[i]!];
      } else {
        for (let i = 1; i < items.length; i++)
          if (ids.has(items[i]!.id) && !ids.has(items[i - 1]!.id))
            [items[i], items[i - 1]] = [items[i - 1]!, items[i]!];
      }
    }
}

// Capas: el índice 0 es la del fondo; la última se dibuja encima.

export function addLayer(scene: Scene, aboveLayerId?: string, kind: Layer['kind'] = 'vector'): string {
  const used = new Set(scene.layers.map((l) => l.name));
  const base = kind === 'frames' ? 'Fotogramas' : 'Capa';
  let n = kind === 'frames' ? 1 : scene.layers.length + 1;
  while (used.has(`${base} ${n}`)) n++;
  const layer = createLayer(`${base} ${n}`, kind);
  const idx = aboveLayerId ? scene.layers.findIndex((l) => l.id === aboveLayerId) : -1;
  if (idx >= 0) scene.layers.splice(idx + 1, 0, layer);
  else scene.layers.push(layer);
  return layer.id;
}

/** Elimina una capa. Siempre queda al menos una. Devuelve la capa que debería quedar activa. */
export function removeLayer(scene: Scene, layerId: string): string {
  const idx = scene.layers.findIndex((l) => l.id === layerId);
  if (idx < 0) return scene.layers[scene.layers.length - 1]!.id;
  if (scene.layers.length === 1) {
    const only = scene.layers[0]!;
    if (only.items) only.items = [];
    if (only.cels) only.cels = [];
    return only.id;
  }
  scene.layers.splice(idx, 1);
  return scene.layers[Math.max(0, idx - 1)]!.id;
}

export function moveLayer(scene: Scene, layerId: string, direction: 'up' | 'down'): void {
  const idx = scene.layers.findIndex((l) => l.id === layerId);
  const target = direction === 'up' ? idx + 1 : idx - 1;
  if (idx < 0 || target < 0 || target >= scene.layers.length) return;
  [scene.layers[idx], scene.layers[target]] = [scene.layers[target]!, scene.layers[idx]!];
}

/** Elementos que se pueden seleccionar en el instante `t` (capas visibles y no bloqueadas). */
export function selectableItems(scene: Scene, t: Ticks = 0): Item[] {
  return scene.layers.filter((l) => l.visible && !l.locked).flatMap((l) => layerItemsAt(l, t));
}

/** Número de elementos de una capa (en las de fotogramas, la suma de todos). */
export function layerItemCount(layer: Layer): number {
  return itemLists(layer).reduce((n, l) => n + l.length, 0);
}

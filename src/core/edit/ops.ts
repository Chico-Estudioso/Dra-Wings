// Operaciones puras sobre escenas (se usan dentro de recetas Immer; mutan el borrador recibido).
import { offset } from '../anim/animated';
import { deepClone } from './clone';
import { createLayer, newId } from '../model/factory';
import type { Item, Layer, Project, Scene } from '../model/types';

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

/** Elementos editables de una capa vectorial (las capas de fotogramas llegan en M4). */
export function layerItems(layer: Layer): Item[] {
  return layer.items ?? [];
}

export function locateItem(scene: Scene, id: string): { layer: Layer; index: number; item: Item } | null {
  for (const layer of scene.layers) {
    const items = layerItems(layer);
    const index = items.findIndex((i) => i.id === id);
    if (index >= 0) return { layer, index, item: items[index]! };
  }
  return null;
}

export function addItem(scene: Scene, layerId: string, item: Item): void {
  const layer = findLayer(scene, layerId);
  if (!layer.items) throw new Error('La capa no admite elementos vectoriales');
  layer.items.push(item);
}

export function removeItems(scene: Scene, ids: ReadonlySet<string>): void {
  for (const layer of scene.layers) if (layer.items) layer.items = layer.items.filter((i) => !ids.has(i.id));
}

/** Sustituye un elemento por otros (por ejemplo, un trazo dividido por la goma) en su misma posición. */
export function replaceItem(scene: Scene, id: string, replacements: Item[]): void {
  const loc = locateItem(scene, id);
  if (!loc || !loc.layer.items) return;
  loc.layer.items.splice(loc.index, 1, ...replacements);
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
    if (!loc || !loc.layer.items) continue;
    const copy = deepClone(loc.item);
    copy.id = newId();
    copy.transform.x = offset(copy.transform.x, dx);
    copy.transform.y = offset(copy.transform.y, dy);
    loc.layer.items.splice(loc.index + 1, 0, copy);
    created.push(copy.id);
  }
  return created;
}

export type ZMove = 'forward' | 'backward' | 'front' | 'back';

/** Cambia el orden de apilado dentro de cada capa. */
export function reorderItems(scene: Scene, ids: ReadonlySet<string>, move: ZMove): void {
  for (const layer of scene.layers) {
    const items = layer.items;
    if (!items || !items.some((i) => ids.has(i.id))) continue;
    const sel = items.filter((i) => ids.has(i.id));
    const rest = items.filter((i) => !ids.has(i.id));
    if (move === 'front') layer.items = [...rest, ...sel];
    else if (move === 'back') layer.items = [...sel, ...rest];
    else if (move === 'forward') {
      for (let i = items.length - 2; i >= 0; i--)
        if (ids.has(items[i]!.id) && !ids.has(items[i + 1]!.id)) [items[i], items[i + 1]] = [items[i + 1]!, items[i]!];
    } else {
      for (let i = 1; i < items.length; i++)
        if (ids.has(items[i]!.id) && !ids.has(items[i - 1]!.id)) [items[i], items[i - 1]] = [items[i - 1]!, items[i]!];
    }
  }
}

// Capas: el índice 0 es la del fondo; la última se dibuja encima.

export function addLayer(scene: Scene, aboveLayerId?: string): string {
  const used = new Set(scene.layers.map((l) => l.name));
  let n = scene.layers.length + 1;
  while (used.has(`Capa ${n}`)) n++;
  const layer = createLayer(`Capa ${n}`);
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

/** Ids de elementos que se pueden seleccionar (capas visibles y no bloqueadas). */
export function selectableItems(scene: Scene): Item[] {
  return scene.layers.filter((l) => l.visible && !l.locked).flatMap(layerItems);
}

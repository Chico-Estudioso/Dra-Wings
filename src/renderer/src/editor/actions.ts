// Acciones del editor sobre el documento. Todas pasan por `apply` (historial de deshacer).
import { fixed } from '@core/anim/animated';
import {
  addItem,
  addLayer,
  duplicateItems,
  findLayer,
  findScene,
  locateItem,
  moveLayer,
  removeItems,
  removeLayer,
  reorderItems,
  replaceItem,
  selectableItems,
  translateItems,
  type ZMove,
} from '@core/edit/ops';
import type { StaticTransform } from '@core/geometry/matrix';
import { groupItems, recolorSlot, ungroupItem } from '@core/edit/group';
import type { Item, Layer, Project, Scene } from '@core/model/types';
import { useApp } from '../state/app-store';
import { useEditor } from './editor-store';

export function currentScene(): Scene | null {
  const project = useApp.getState().doc?.project;
  const sceneId = useEditor.getState().sceneId;
  return project?.scenes.find((s) => s.id === sceneId) ?? null;
}

export function editScene(label: string, fn: (scene: Scene, project: Project) => void): void {
  const sceneId = useEditor.getState().sceneId;
  if (!sceneId) return;
  useApp.getState().apply(label, (p) => fn(findScene(p, sceneId), p));
}

/** Capa donde se crean elementos; avisa si está oculta o bloqueada. */
export function writableActiveLayer(): Layer | null {
  const scene = currentScene();
  const id = useEditor.getState().activeLayerId;
  const layer = scene?.layers.find((l) => l.id === id) ?? null;
  if (!layer) return null;
  if (layer.locked || !layer.visible) {
    useApp.getState().notify({
      kind: 'info',
      text: layer.locked
        ? `La capa «${layer.name}» está bloqueada. Desbloquéala o elige otra para dibujar.`
        : `La capa «${layer.name}» está oculta. Muéstrala o elige otra para dibujar.`,
    });
    return null;
  }
  return layer;
}

export function addToActiveLayer(item: Item, label: string, select = false): boolean {
  const layer = writableActiveLayer();
  if (!layer) return false;
  editScene(label, (scene) => addItem(scene, layer.id, item));
  if (select) useEditor.getState().select([item.id]);
  return true;
}

export function deleteSelection(): void {
  const ids = useEditor.getState().selection;
  if (!ids.length) return;
  editScene(ids.length > 1 ? 'Eliminar elementos' : 'Eliminar elemento', (scene) => removeItems(scene, new Set(ids)));
  useEditor.getState().select([]);
}

export function duplicateSelection(): void {
  const ids = useEditor.getState().selection;
  if (!ids.length) return;
  let created: string[] = [];
  editScene('Duplicar', (scene) => {
    created = duplicateItems(scene, ids);
  });
  useEditor.getState().select(created);
}

export function selectAll(): void {
  const scene = currentScene();
  if (scene) useEditor.getState().select(selectableItems(scene).map((i) => i.id));
}

export function nudgeSelection(dx: number, dy: number): void {
  const ids = useEditor.getState().selection;
  if (ids.length) editScene('Mover', (scene) => translateItems(scene, ids, dx, dy));
}

export function reorderSelection(move: ZMove): void {
  const ids = useEditor.getState().selection;
  if (ids.length) editScene('Ordenar', (scene) => reorderItems(scene, new Set(ids), move));
}

export function commitTransforms(label: string, transforms: ReadonlyMap<string, StaticTransform>): void {
  if (transforms.size === 0) return;
  editScene(label, (scene) => {
    for (const [id, t] of transforms) {
      const loc = locateItem(scene, id);
      if (!loc) continue;
      const tr = loc.item.transform;
      tr.x = fixed(t.x);
      tr.y = fixed(t.y);
      tr.scaleX = fixed(t.scaleX);
      tr.scaleY = fixed(t.scaleY);
      tr.rotation = fixed(t.rotation);
    }
  });
}

export function commitErase(replacements: ReadonlyMap<string, Item[]>): void {
  if (replacements.size === 0) return;
  editScene('Borrar', (scene) => {
    for (const [id, items] of replacements) replaceItem(scene, id, items);
  });
  const sel = useEditor.getState().selection.filter((id) => !replacements.has(id));
  useEditor.getState().select(sel);
}

export function updateSelected(label: string, fn: (item: Item) => void): void {
  const ids = useEditor.getState().selection;
  if (!ids.length) return;
  editScene(label, (scene) => {
    for (const id of ids) {
      const loc = locateItem(scene, id);
      if (loc) fn(loc.item);
    }
  });
}

// Capas

export function addLayerAboveActive(): void {
  let id = '';
  editScene('Nueva capa', (scene) => {
    id = addLayer(scene, useEditor.getState().activeLayerId ?? undefined);
  });
  if (id) useEditor.getState().setActiveLayer(id);
}

export function deleteLayer(layerId: string): void {
  let next = '';
  editScene('Eliminar capa', (scene) => {
    next = removeLayer(scene, layerId);
  });
  if (next) useEditor.getState().setActiveLayer(next);
  useEditor.getState().select([]);
}

export function updateLayer(layerId: string, label: string, fn: (layer: Layer) => void): void {
  editScene(label, (scene) => fn(findLayer(scene, layerId)));
  // Si la capa deja de ser editable, se quita su contenido de la selección.
  const layer = currentScene()?.layers.find((l) => l.id === layerId);
  if (layer && (layer.locked || !layer.visible)) {
    const inLayer = new Set((layer.items ?? []).map((i) => i.id));
    useEditor.getState().select(useEditor.getState().selection.filter((id) => !inLayer.has(id)));
  }
}

export function shiftLayer(layerId: string, direction: 'up' | 'down'): void {
  editScene('Ordenar capas', (scene) => moveLayer(scene, layerId, direction));
}

// Biblioteca y grupos

/** Inserta elementos en la capa activa y los selecciona. */
export function insertItems(items: Item[], label: string): boolean {
  const layer = writableActiveLayer();
  if (!layer || items.length === 0) return false;
  editScene(label, (scene) => {
    for (const it of items) addItem(scene, layer.id, it);
  });
  useEditor.getState().select(items.map((i) => i.id));
  useEditor.getState().setTool('select');
  useEditor.getState().select(items.map((i) => i.id));
  return true;
}

export function groupSelection(): void {
  const ids = useEditor.getState().selection;
  let id: string | null = null;
  editScene('Agrupar', (scene) => {
    id = groupItems(scene, ids);
  });
  if (id) useEditor.getState().select([id]);
  else
    useApp.getState().notify({ kind: 'info', text: 'Para agrupar, selecciona dos o más elementos de la misma capa.' });
}

export function ungroupSelection(): void {
  const ids = useEditor.getState().selection;
  const created: string[] = [];
  editScene('Desagrupar', (scene) => {
    for (const id of ids) created.push(...ungroupItem(scene, id));
  });
  if (created.length) useEditor.getState().select(created);
}

export function recolorSelected(slotId: string, color: string): void {
  updateSelected('Cambiar color', (it) => {
    if (it.type === 'group') recolorSlot(it, slotId, color);
  });
}

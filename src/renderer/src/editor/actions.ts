// Acciones del editor sobre el documento. Todas pasan por `apply` (historial de deshacer).
import {
  addItem,
  addLayer,
  celAt,
  duplicateItems,
  findLayer,
  findScene,
  layerItemCount,
  locateItem,
  moveLayer,
  removeItems,
  removeLayer,
  reorderItems,
  replaceItem,
  selectableItems,
  withNewIds,
  type ZMove,
} from '@core/edit/ops';
import type { StaticTransform } from '@core/geometry/matrix';
import { appendTiming, fitSceneDuration } from '@core/anim/timing';
import { ANIMATABLE, clearAnimation, keyTimes, removeKeyAt, setValueAt, shiftItemTime } from '@core/anim/keyframes';
import { addScene, duplicateScene, moveScene, removeScene } from '@core/edit/scenes';
import { ticksPerFrame, TICKS_PER_SECOND, type Ticks } from '@core/time/ticks';
import { moveBetween, removeStep, type Step } from '@core/anim/steps';
import { groupItems, recolorSlot, removeSwap, ungroupItem } from '@core/edit/group';
import { setCharacterLook, type CharacterOptions } from '@core/library/character';
import type { BoilLevel } from '@core/render/boil';
import type { LifeKind } from '@core/anim/life';
import type { ElasticLevel } from '@core/anim/elastic';
import type { LoopKind } from '@core/anim/loop';
import type { HandStyle } from '@core/render/hand';
import type { PaperStyle } from '@core/render/paper';
import type { TextReveal } from '@core/render/text-reveal';
import { sceneBeats, type Beat } from '@core/audio/rhythm';
import { barAlignedDuration, beatsOrPulse, staggerTimes } from '@core/edit/beat-sync';
import { worldBounds } from '@core/geometry/items';
import { deepClone } from '@core/edit/clone';
import { newId } from '@core/model/factory';
import type { Ease, Enter, Exit, Item, Layer, Project, Scene } from '@core/model/types';
import { applyPreset, mergeKeys, PRESET_LABELS, setItemEase, type Direction, type PresetId } from '@core/anim/presets';
import { samplesToKeys, type MotionSample } from '@core/anim/record';
import { resolveTransform } from '@core/geometry/matrix';
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

const playhead = () => useEditor.getState().playhead;
const fps = () => useApp.getState().doc!.project.settings.fps;

/** Añade elementos a la capa: en capas vectoriales con tiempo automático; en fotogramas, al del cabezal. */
function addTimed(scene: Scene, layer: Layer, items: Item[]) {
  if (layer.kind === 'frames') {
    for (const it of items) addItem(scene, layer.id, it, playhead(), ticksPerFrame(fps()) * 2);
    return;
  }
  for (const it of items) {
    appendTiming(scene, it);
    addItem(scene, layer.id, it);
  }
  fitSceneDuration(scene);
}

export function addToActiveLayer(item: Item, label: string, select = false): boolean {
  const layer = writableActiveLayer();
  if (!layer) return false;
  editScene(label, (scene) => addTimed(scene, findLayer(scene, layer.id), [item]));
  if (select) useEditor.getState().select([item.id]);
  return true;
}

/**
 * Añade un trazo y sus copias (dibujo en espejo) en un solo paso: las copias empiezan y tardan lo
 * mismo que el original, así que en el vídeo se dibujan a la vez.
 */
export function addWithCopies(item: Item, copies: Item[], label: string): boolean {
  if (!copies.length) return addToActiveLayer(item, label);
  const layer = writableActiveLayer();
  if (!layer) return false;
  editScene(label, (scene) => {
    const target = findLayer(scene, layer.id);
    if (target.kind === 'frames') return addTimed(scene, target, [item, ...copies]);
    addTimed(scene, target, [item]);
    for (const c of copies) {
      c.in = item.in;
      if (item.enter) c.enter = { ...item.enter };
      addItem(scene, target.id, c);
    }
  });
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
  if (scene) useEditor.getState().select(selectableItems(scene, playhead()).map((i) => i.id));
}

export function nudgeSelection(dx: number, dy: number): void {
  const scene = currentScene();
  const ids = useEditor.getState().selection;
  if (!scene || !ids.length) return;
  const t = playhead();
  const next = new Map<string, StaticTransform>();
  for (const id of ids) {
    const it = locateItem(scene, id)?.item;
    if (!it) continue;
    const st = resolveTransform(it.transform, t);
    next.set(id, { ...st, x: st.x + dx, y: st.y + dy });
  }
  commitTransforms('Mover', next);
}

export function reorderSelection(move: ZMove): void {
  const ids = useEditor.getState().selection;
  if (ids.length) editScene('Ordenar', (scene) => reorderItems(scene, new Set(ids), move));
}

/**
 * Aplica transformaciones en el instante del cabezal: crea o actualiza keyframes si la propiedad ya
 * está animada o si «Grabar movimiento» está activo; si no, cambia el valor constante.
 */
export function commitTransforms(label: string, transforms: ReadonlyMap<string, StaticTransform>): void {
  if (transforms.size === 0) return;
  const t = playhead();
  const moveTo = useEditor.getState().moveTo;
  if (moveTo) return commitMoveTo(transforms, t, moveTo.duration);
  const record = useEditor.getState().autoKey;
  editScene(label, (scene) => {
    for (const [id, st] of transforms) {
      const loc = locateItem(scene, id);
      if (!loc) continue;
      const tr = loc.item.transform;
      for (const p of ANIMATABLE) tr[p] = setValueAt(tr[p], t, st[p], record, loc.item.in);
    }
  });
}

/**
 * «Ir a otro sitio»: lo movido va desde donde estaba en el cabezal hasta donde se ha soltado, en
 * `duration`. El cabezal avanza al final para poder encadenar otro paso; la escena se alarga si hace
 * falta.
 */
function commitMoveTo(transforms: ReadonlyMap<string, StaticTransform>, t0: Ticks, duration: Ticks): void {
  const t1 = t0 + duration;
  editScene('Ir a otro sitio', (scene) => {
    for (const [id, st] of transforms) {
      const loc = locateItem(scene, id);
      if (!loc) continue;
      const tr = loc.item.transform;
      for (const p of ANIMATABLE) tr[p] = moveBetween(tr[p], Math.max(t0, loc.item.in), t1, st[p]);
    }
    if (t1 + HOLD_AFTER_MOVE > scene.duration) scene.duration = t1 + HOLD_AFTER_MOVE;
  });
  useEditor.getState().setPlayhead(t1);
}

/** Rato que queda tras el último «ir a otro sitio» si la escena se alarga. */
const HOLD_AFTER_MOVE = Math.round(TICKS_PER_SECOND / 2);

export function setSelectedOpacity(v: number): void {
  const t = playhead();
  const record = useEditor.getState().autoKey;
  updateSelected('Cambiar opacidad', (it) => void (it.opacity = setValueAt(it.opacity, t, v, record, it.in)));
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

/** Animación rápida a la selección en el cabezal; la escena se alarga si la animación acaba después. */
export function applyPresetToSelection(preset: PresetId, direction: Direction): void {
  const ids = useEditor.getState().selection;
  if (!ids.length) return;
  const t = playhead();
  editScene(`Animación: ${PRESET_LABELS[preset].toLowerCase()}`, (scene, project) => {
    let end = t;
    for (const id of ids) {
      const loc = locateItem(scene, id);
      if (loc) end = Math.max(end, applyPreset(loc.item, preset, t, { page: project.settings, direction }));
    }
    if (end > scene.duration) scene.duration = end;
  });
}

/**
 * Guarda el recorrido grabado con «Animar arrastrando» como keyframes de posición (sustituye los que
 * hubiera en ese tramo). Devuelve si se guardó algo.
 */
export function commitMotion(sceneId: string, id: string, samples: MotionSample[]): boolean {
  const { x, y } = samplesToKeys(samples);
  if (x.length < 2) return false;
  useApp.getState().apply('Animar arrastrando', (p) => {
    const loc = locateItem(findScene(p, sceneId), id);
    if (!loc) return;
    loc.item.transform.x = mergeKeys(loc.item.transform.x, x);
    loc.item.transform.y = mergeKeys(loc.item.transform.y, y);
  });
  return true;
}

/** Vida automática de la selección (null: quieta). */
export function setSelectionLife(kind: LifeKind | null, amount = 1): void {
  updateSelected('Vida automática', (it) => {
    it.life = kind ? { kind, amount } : undefined;
  });
}

/** Golpes de la escena actual (o el pulso de 120 BPM). */
export function currentBeats(scene: Scene): Beat[] {
  const project = useApp.getState().doc!.project;
  return beatsOrPulse(sceneBeats(project, scene.id, scene.duration), scene.duration);
}

/**
 * Los elementos seleccionados aparecen uno en cada golpe (o compás) desde el cabezal, en orden de
 * lectura (de izquierda a derecha y de arriba abajo). Sus keyframes se desplazan con ellos.
 */
export function appearOnBeats(bars: boolean): void {
  const ids = useEditor.getState().selection;
  const scene = currentScene();
  if (!ids.length || !scene) return;
  const t = playhead();
  const items = ids
    .map((id) => locateItem(scene, id)?.item)
    .filter((i): i is Item => !!i)
    .map((i) => ({ id: i.id, b: worldBounds(i, t) }))
    .sort((a, b) => a.b.x + a.b.w / 2 - (b.b.x + b.b.w / 2) || a.b.y - b.b.y);
  const times = staggerTimes(currentBeats(scene), t, items.length, bars);
  const gap = times.length >= 2 ? times[1]! - times[0]! : ticksPerFrame(fps()) * 15;
  editScene(bars ? 'Aparecer en cada compás' : 'Aparecer en cada golpe', (draft) => {
    items.forEach(({ id }, i) => {
      const loc = locateItem(draft, id);
      if (!loc) return;
      shiftItemTime(loc.item, times[i]! - loc.item.in);
      // Que cada aparición termine antes de la siguiente.
      if (loc.item.enter && loc.item.enter.duration > gap) loc.item.enter = { ...loc.item.enter, duration: gap };
    });
    fitSceneDuration(draft);
  });
}

/** El final de la escena cae en el inicio de compás más cercano. */
export function alignSceneToBars(): void {
  const scene = currentScene();
  if (!scene) return;
  const next = barAlignedDuration(currentBeats(scene), scene.duration);
  if (next !== scene.duration)
    editScene('Ajustar la escena al compás', (draft) => {
      draft.duration = next;
    });
}

/** Cámara que late con el compás en la escena actual. */
export function setBeatPulse(on: boolean): void {
  editScene('Cámara al ritmo', (draft) => {
    draft.beatPulse = on || undefined;
  });
}

/** Forma de escribirse de los textos seleccionados (se dibujan al aparecer para que se note). */
export function setTextReveal(reveal: TextReveal): void {
  updateSelected('Forma de escribirse', (it) => {
    if (it.type !== 'text') return;
    it.reveal = reveal === 'letters' ? undefined : reveal;
    if (!it.enter || it.enter.kind !== 'draw')
      it.enter = { kind: 'draw', duration: it.enter?.duration || ticksPerFrame(fps()) * 30 };
  });
}

/** Tipo de hoja del proyecto. */
export function setPaper(paper: PaperStyle): void {
  useApp.getState().apply('Tipo de hoja', (p) => {
    p.settings.paper = paper === 'plain' ? undefined : paper;
  });
}

/** Mano que dibuja del proyecto. */
export function setHand(hand: HandStyle): void {
  useApp.getState().apply('Mano que dibuja', (p) => {
    p.settings.hand = hand;
  });
}

/** La cámara de la escena actual sigue a un elemento (null: vuelve la cámara manual). */
export function setFollow(id: string | null, zoom = 1.6): void {
  editScene(id ? 'Seguir con la cámara' : 'Dejar de seguir con la cámara', (scene) => {
    scene.follow = id ? { id, zoom } : undefined;
  });
}

/** Elasticidad del proyecto. */
export function setElastic(level: ElasticLevel): void {
  useApp.getState().apply('Elasticidad', (p) => {
    p.settings.elastic = level;
  });
}

/** Qué hace la animación de la selección al acabar sus keyframes. */
export function setSelectionLoop(loop: LoopKind | 'none'): void {
  updateSelected('Repetir movimiento', (it) => {
    it.loop = loop === 'none' ? undefined : loop;
  });
}

/** Estela al moverse en la selección. */
export function setSelectionTrail(on: boolean): void {
  updateSelected('Estela', (it) => {
    it.trail = on || undefined;
  });
}

/** Intensidad del «trazo vivo» del proyecto. */
export function setBoil(level: BoilLevel): void {
  useApp.getState().apply('Trazo vivo', (p) => {
    p.settings.boil = level;
  });
}

/** Cambia la expresión o la postura del personaje seleccionado desde el cabezal. */
export function setLookAtPlayhead(look: Partial<Pick<CharacterOptions, 'expression' | 'pose'>>): void {
  const t = playhead();
  updateSelected(look.pose ? 'Cambiar postura' : 'Cambiar expresión', (it) => {
    if (it.type === 'group') setCharacterLook(it, t, look);
  });
}

/** El personaje seleccionado mueve la boca con la voz de la narración. */
export function setTalk(on: boolean): void {
  updateSelected('Hablar con la narración', (it) => {
    if (it.type === 'group') it.talk = on || undefined;
  });
}

/** Quita el cambio de aspecto del instante `t` del personaje seleccionado. */
export function removeLookChange(t: number): void {
  updateSelected('Quitar cambio de aspecto', (it) => {
    if (it.type === 'group') removeSwap(it, t);
  });
}

export function setSelectionEase(ease: Ease): void {
  updateSelected('Suavizado del movimiento', (it) => setItemEase(it, ease));
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
    const inLayer = new Set(itemListsIds(layer));
    useEditor.getState().select(useEditor.getState().selection.filter((id) => !inLayer.has(id)));
  }
}

export function shiftLayer(layerId: string, direction: 'up' | 'down'): void {
  editScene('Ordenar capas', (scene) => moveLayer(scene, layerId, direction));
}

// Biblioteca y grupos

/** Inserta elementos en la capa activa y los selecciona. */
export function insertItems(items: Item[], label: string, prepare?: (project: Project) => void): boolean {
  const layer = writableActiveLayer();
  if (!layer || items.length === 0) return false;
  editScene(label, (scene, project) => {
    prepare?.(project);
    addTimed(scene, findLayer(scene, layer.id), items);
  });
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

// Animación

export function setEnter(enter: Enter): void {
  updateSelected('Aparición', (it) => void (it.enter = { ...enter, mode: it.enter?.mode }));
  const scene = currentScene();
  if (scene) editScene('Aparición', (sc) => fitSceneDuration(sc));
}

export function setExit(exit: Exit | null, atPlayhead: boolean): void {
  const t = playhead();
  updateSelected('Desaparición', (it) => {
    if (!exit) {
      delete it.out;
      delete it.exit;
      return;
    }
    if (atPlayhead) it.out = Math.max(it.in + 1, t);
    it.exit = exit;
  });
}

export function setInAtPlayhead(): void {
  const t = playhead();
  updateSelected('Mover en el tiempo', (it) => shiftItemTime(it, t - it.in));
  editScene('Mover en el tiempo', (sc) => fitSceneDuration(sc));
}

/** Desplaza en el tiempo los elementos (entrada, salida y keyframes). */
export function shiftItemsTime(ids: string[], dt: number, label = 'Mover en el tiempo'): void {
  if (!ids.length || dt === 0) return;
  editScene(label, (scene) => {
    for (const id of ids) {
      const loc = locateItem(scene, id);
      if (loc) shiftItemTime(loc.item, Math.max(dt, -loc.item.in));
    }
    fitSceneDuration(scene);
  });
}

export function setEnterDuration(id: string, duration: number): void {
  editScene('Duración de la aparición', (scene) => {
    const it = locateItem(scene, id)?.item;
    if (it)
      it.enter = {
        kind: it.enter?.kind && it.enter.kind !== 'none' ? it.enter.kind : 'draw',
        duration: Math.max(1, Math.round(duration)),
        mode: it.enter?.mode,
      };
    fitSceneDuration(scene);
  });
}

export function removeKeyAtPlayhead(): void {
  const t = playhead();
  updateSelected('Quitar keyframe', (it) => {
    for (const p of ANIMATABLE) it.transform[p] = removeKeyAt(it.transform[p], t);
    it.opacity = removeKeyAt(it.opacity, t);
  });
}

export function clearSelectionAnimation(): void {
  const t = playhead();
  updateSelected('Quitar movimiento', (it) => clearAnimation(it, t));
}

export function selectionKeyTimes(): number[] {
  const scene = currentScene();
  if (!scene) return [];
  const set = new Set<number>();
  for (const id of useEditor.getState().selection) {
    const it = locateItem(scene, id)?.item;
    if (it) keyTimes(it).forEach((k) => set.add(k));
  }
  return [...set].sort((a, b) => a - b);
}

// Escenas

function topLayerId(scene: Scene): string {
  return scene.layers[scene.layers.length - 1]!.id;
}

export function goToScene(sceneId: string): void {
  const scene = useApp.getState().doc?.project.scenes.find((s) => s.id === sceneId);
  if (scene) useEditor.getState().setScene(scene.id, topLayerId(scene));
}

export function addSceneAfterCurrent(): void {
  let id = '';
  useApp.getState().apply('Nueva escena', (p) => {
    id = addScene(p, useEditor.getState().sceneId ?? undefined);
  });
  goToScene(id);
}

export function duplicateCurrentScene(): void {
  const current = useEditor.getState().sceneId;
  if (!current) return;
  let id: string | null = null;
  useApp.getState().apply('Duplicar escena', (p) => {
    id = duplicateScene(p, current);
  });
  if (id) goToScene(id);
}

export function deleteCurrentScene(): void {
  const current = useEditor.getState().sceneId;
  if (!current) return;
  let next = current;
  useApp.getState().apply('Eliminar escena', (p) => {
    next = removeScene(p, current);
  });
  goToScene(next);
}

export function moveCurrentScene(direction: -1 | 1): void {
  const current = useEditor.getState().sceneId;
  if (current) useApp.getState().apply('Ordenar escenas', (p) => moveScene(p, current, direction));
}

export function updateCurrentScene(label: string, fn: (scene: Scene) => void): void {
  editScene(label, (scene) => fn(scene));
}

// Cámara

export function commitCamera(next: { x: number; y: number; zoom: number }): void {
  const t = playhead();
  const record = useEditor.getState().autoKey;
  editScene('Encuadre', (scene) => {
    const c = scene.camera;
    c.x = setValueAt(c.x, t, next.x, record, 0);
    c.y = setValueAt(c.y, t, next.y, record, 0);
    c.scaleX = setValueAt(c.scaleX, t, next.zoom, record, 0);
    c.scaleY = setValueAt(c.scaleY, t, next.zoom, record, 0);
  });
}

export function resetCamera(): void {
  editScene('Restablecer encuadre', (scene) => {
    const c = scene.camera;
    c.x = { value: 0 };
    c.y = { value: 0 };
    c.scaleX = { value: 1 };
    c.scaleY = { value: 1 };
  });
}

// Fotogramas

export function addFramesLayer(): void {
  let id = '';
  editScene('Nueva capa de fotogramas', (scene) => {
    id = addLayer(scene, useEditor.getState().activeLayerId ?? undefined, 'frames');
  });
  if (id) useEditor.getState().setActiveLayer(id);
}

/** Crea un fotograma vacío (o una copia del actual) justo después del fotograma del cabezal. */
export function addCelAfterPlayhead(copy: boolean): void {
  const layerId = useEditor.getState().activeLayerId;
  const tpf = ticksPerFrame(fps());
  let nextStart = playhead();
  editScene(copy ? 'Duplicar fotograma' : 'Nuevo fotograma', (scene) => {
    const layer = findLayer(scene, layerId!);
    if (layer.kind !== 'frames') return;
    layer.cels ??= [];
    const current = celAt(layer, playhead());
    const start = current ? current.start + current.duration : playhead();
    const duration = current?.duration ?? tpf * 2;
    // Hace hueco desplazando los fotogramas posteriores.
    for (const c of layer.cels) if (c.start >= start) c.start += duration;
    const items = copy && current ? current.items.map((i) => withNewIdsDeep(i)) : [];
    layer.cels.push({ id: newIdLocal(), start, duration, items });
    layer.cels.sort((a, b) => a.start - b.start);
    nextStart = start;
    fitCelsDuration(scene, layer);
  });
  useEditor.getState().setPlayhead(nextStart);
}

function fitCelsDuration(scene: Scene, layer: Layer) {
  const end = Math.max(0, ...(layer.cels ?? []).map((c) => c.start + c.duration));
  if (end > scene.duration) scene.duration = end;
}

const newIdLocal = () => newId();
const withNewIdsDeep = (i: Item) => withNewIds(deepClone(i));

function itemListsIds(layer: Layer): string[] {
  return layer.kind === 'frames'
    ? (layer.cels ?? []).flatMap((c) => c.items.map((i) => i.id))
    : (layer.items ?? []).map((i) => i.id);
}

export { layerItemCount };

/** Quita un paso de lo que hace el elemento seleccionado (lista «Lo que hace»). */
export function removeStepFromSelection(step: Step): void {
  updateSelected(`Quitar: ${step.label.toLowerCase()}`, (it) => removeStep(it, step));
}

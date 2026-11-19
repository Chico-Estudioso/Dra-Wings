// Bote de pintura: al hacer clic dentro de un dibujo cerrado se crea una forma rellena con su
// contorno exacto (con agujeros), debajo de las líneas que la rodean y apareciendo justo cuando
// terminan de dibujarse. Sobre una forma ya rellena (también un relleno anterior), la recolorea.
import { DEFAULT_FILL, fillRegion, traceRegion } from '@core/draw/fill';
import { fitSceneDuration } from '@core/anim/timing';
import { layerItemsAt, locateItem, selectableItems, type ItemLocation } from '@core/edit/ops';
import { hitItem } from '@core/geometry/items';
import type { Point } from '@core/geometry/matrix';
import { createShape } from '@core/model/factory';
import type { Item, Shape } from '@core/model/types';
import { drawRenderList, PathCache } from '@core/render/draw';
import { evaluateScene } from '@core/render/evaluate';
import { sceneBackground } from '@core/render/frame';
import { TICKS_PER_SECOND } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { currentScene, editScene, writableActiveLayer } from './actions';
import { useEditor } from './editor-store';
import { imageSourcesFor } from './media';

/** Lado mayor de la imagen sobre la que se calcula el relleno. */
const MAX_SIDE = 1600;
/** Huecos que se cierran solos, en píxeles de pantalla (lo que el usuario ve como «un hueco pequeño»). */
const GAPS_SCREEN = [3, 6, 10];
/** Bordes de la zona que se miran para saber qué líneas la rodean. */
const BORDER_SAMPLES = 400;
const FADE = Math.round(0.35 * TICKS_PER_SECOND);

const notify = (text: string) => useApp.getState().notify({ kind: 'info', text });

const isLine = (it: Item) =>
  it.type === 'stroke' || (it.type === 'shape' && (it.shape === 'line' || it.shape === 'arrow' || !it.style.fill));

/** Elemento visible más alto bajo el punto (sin contar textos, que se pintan alrededor). */
function topAt(items: Item[], p: Point, tol: number, t: number): Item | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.type !== 'text' && hitItem(it, p, tol, t)) return it;
  }
  return null;
}

/** Rellena en el punto `p` (unidades de la hoja). */
export function fillAt(p: Point): void {
  const project = useApp.getState().doc?.project;
  const scene = currentScene();
  const ed = useEditor.getState();
  if (!project || !scene) return;
  const { width, height } = project.settings;
  // Fondo liso aunque sea un degradado: el fondo nunca hace de borde y así no corta el relleno.
  const background = sceneBackground(project.settings, scene);
  if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) return notify('Haz clic dentro de la hoja para rellenar.');
  const color = ed.options.bucket;
  const t = ed.playhead;
  const items = selectableItems(scene, t);
  // Las líneas de capas bloqueadas también hacen de borde (línea bloqueada arriba, color debajo).
  const visible = scene.layers.filter((l) => l.visible).flatMap((l) => layerItemsAt(l, t));
  const tol = 2 / ed.view.zoom;

  const top = topAt(items, p, tol, t);
  if (top?.type === 'shape' && !isLine(top)) {
    editScene('Cambiar el color del relleno', (s) => {
      const loc = locateItem(s, top.id);
      if (loc?.item.type === 'shape') loc.item.style.fill = color;
    });
    return;
  }
  if (top?.type === 'group')
    return notify('Este dibujo es un recurso de la biblioteca: cambia sus colores en el panel de propiedades.');
  if (top?.type === 'image') return notify('Las imágenes importadas no se pueden rellenar.');
  if (top && isLine(top)) return notify('Haz clic dentro de la zona que quieres pintar, no sobre la línea.');
  if (!writableActiveLayer()) return;

  // Imagen del dibujo tal como se ve al editar (sin la textura del papel, que no son paredes).
  const scale = Math.min(2, MAX_SIDE / Math.max(width, height));
  const W = Math.max(1, Math.round(width * scale));
  const H = Math.max(1, Math.round(height * scale));
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(W / width, 0, 0, H / height, 0, 0);
  drawRenderList(ctx, evaluateScene(scene, t, { mode: 'edit' }), new PathCache(), imageSourcesFor(project));
  const pixels = ctx.getImageData(0, 0, W, H);
  const perScreenPx = W / width / ed.view.zoom;
  const gaps = [0, ...new Set(GAPS_SCREEN.map((g) => Math.min(40, Math.max(1, Math.round(g * perScreenPx)))))];
  const region = fillRegion({ width: W, height: H, data: pixels.data }, p.x * (W / width), p.y * (H / height), {
    ...DEFAULT_FILL,
    gaps,
  });
  const contours = region && traceRegion(region.mask, W, H);
  if (!region || !contours || contours.outer.length < 6)
    return notify('Aquí no hay una zona que rellenar. Haz clic dentro de un dibujo cerrado.');

  // Qué líneas rodean la zona: se mira justo fuera de su borde.
  const around = new Set<string>();
  const border: number[] = [];
  const { mask } = region;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % W;
    if (
      (x > 0 && !mask[i - 1]) ||
      (x < W - 1 && !mask[i + 1]) ||
      (i >= W && !mask[i - W]) ||
      (i < W * (H - 1) && !mask[i + W])
    )
      border.push(i);
  }
  const step = Math.max(1, Math.floor(border.length / BORDER_SAMPLES));
  for (let k = 0; k < border.length; k += step) {
    const i = border[k]!;
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || mask[ny * W + nx]) continue;
      const hit = topAt(visible, { x: (nx + 0.5) * (width / W), y: (ny + 0.5) * (height / H) }, 1.5 * (width / W), t);
      if (hit) around.add(hit.id);
    }
  }

  // Forma rellena en unidades de la hoja, con su caja como origen.
  const sx = width / W;
  const sy = height / H;
  const rings = [contours.outer, ...contours.holes].map((r) => r.map((v, i) => (i % 2 ? v * sy : v * sx)));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < rings[0]!.length; i += 2) {
    x0 = Math.min(x0, rings[0]![i]!);
    x1 = Math.max(x1, rings[0]![i]!);
    y0 = Math.min(y0, rings[0]![i + 1]!);
    y1 = Math.max(y1, rings[0]![i + 1]!);
  }
  const local = (r: number[]) => r.map((v, i) => Math.round((i % 2 ? v - y0 : v - x0) * 10) / 10);
  const shape: Shape = createShape('polygon', x0, y0, x1 - x0, y1 - y0, {
    stroke: null,
    strokeWidth: 0,
    fill: color,
    opacity: 1,
  });
  shape.name = 'Relleno';
  shape.points = local(rings[0]!);
  if (rings.length > 1) shape.holes = rings.slice(1).map(local);
  shape.smooth = true;

  editScene('Rellenar', (s) => {
    // Debajo de la más baja de las líneas que la rodean, en una capa donde se pueda dibujar.
    const locs = [...around].map((id) => locateItem(s, id)).filter((l): l is ItemLocation => !!l);
    const layerIndex = (l: ItemLocation) => s.layers.indexOf(l.layer);
    locs.sort((a, b) => layerIndex(a) - layerIndex(b) || a.index - b.index);
    const target = locs.find((l) => !l.layer.locked);
    const active = s.layers.find((l) => l.id === ed.activeLayerId)!;
    const list = target
      ? target.list
      : (active.items ?? active.cels?.find((c) => c.start <= t && t < c.start + c.duration)?.items);
    if (!list) return;
    const index = target ? target.index : 0;
    if (!target?.cel && (target?.layer ?? active).kind === 'vector') {
      // Aparece cuando terminan de dibujarse sus líneas, con un fundido corto.
      let start = 0;
      for (const l of locs) start = Math.max(start, l.item.in + (l.item.enter?.duration ?? 0));
      shape.in = start;
      shape.enter = { kind: 'fade', duration: FADE };
    }
    list.splice(index, 0, shape);
    fitSceneDuration(s);
  });
}

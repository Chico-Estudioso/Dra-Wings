import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sceneBeats } from '@core/audio/rhythm';
import { createShape, createStroke } from '@core/model/factory';
import { eraseItems } from '@core/edit/erase';
import { celAt, locateItem, selectableItems } from '@core/edit/ops';
import { hitItem, rectsIntersect, unionRects, worldBounds, type Rect } from '@core/geometry/items';
import { resizeGroup, resizeSingle, rotateGroup, snapAngle, type Handle } from '@core/geometry/manipulate';
import { apply, invert, matrixFrom, resolveTransform, type Point, type StaticTransform } from '@core/geometry/matrix';
import { drawRenderList, outlineToPath, PathCache, type Ctx2D } from '@core/render/draw';
import { cameraMatrix, evaluateScene, hasCamera } from '@core/render/evaluate';
import { motionPath } from '@core/anim/motion-path';
import type { MotionSample } from '@core/anim/record';
import { ticksPerFrame, type Ticks } from '@core/time/ticks';
import { drawSceneFrame } from '@core/render/frame';
import { strokeOutline } from '@core/render/stroke-outline';
import type { Item, Project, Scene } from '@core/model/types';
import {
  addToActiveLayer,
  commitCamera,
  commitErase,
  commitMotion,
  commitTransforms,
  currentScene,
  goToScene,
  writableActiveLayer,
} from './actions';
import { useApp } from '../state/app-store';
import { SHAPE_TOOLS, useEditor, type Tool, type ToolOptions } from './editor-store';
import { finishFreehand, LazyBrush, packShape, STABILIZER_PX } from '@core/draw/assist';
import { recognizeShape, SHAPE_LABELS, type Recognized } from '@core/draw/recognize';
import { fontsReady } from './fonts';
import { cursorForHandle, handlePoint, HANDLES, rotateHandlePoint, selectionGeometry, transformOf } from './selection';
import { fitView, toScene, zoomAt } from './view';
import { TextEditor, type TextEditTarget } from './TextEditor';
import { LIBRARY } from '@core/library/catalog';
import { ASSET_MIME, insertAsset } from './LibraryPanel';
import { imageSourcesFor, useMediaVersion } from './media';
import { itemName } from './item-names';
import { hasFiles, importDroppedFiles } from './drop-files';

const HANDLE_PX = 9;
const ROTATE_OFFSET_PX = 28;
const HIT_TOLERANCE_PX = 6;
const SELECTION_COLOR = '#2f6fd6';
const GUIDE_COLOR = '#e0408a';
const SNAP_PX = 7;
const PATH_COLOR = 'rgba(47,111,214,0.75)';
/** Tiempo con el puntero quieto al final de un trazo para convertirlo en forma. */
const HOLD_MS = 450;
/** Moverse más que esto (píxeles de pantalla) cuenta como seguir dibujando. */
const HOLD_SLOP_PX = 5;
const TRAIL_COLOR = '#e0408a';

/** «Animar arrastrando»: el elemento sigue al puntero mientras la escena se reproduce. */
interface PuppetGesture {
  kind: 'puppet';
  item: Item;
  scene: Scene;
  t0: Ticks;
  /** Posición (x, y) del elemento al empezar. */
  base: Point;
  /** Punto del mundo bajo el puntero al empezar (a través de la cámara). */
  from: Point;
  /** Punto de la hoja bajo el puntero ahora, y al empezar. */
  page: Point;
  page0: Point;
  /** Del origen del elemento a su centro (para dibujar el rastro). */
  pivot: Point;
  samples: MotionSample[];
  moved: boolean;
  unsub: () => void;
}

/** Punto del mundo que se ve en un punto de la hoja en la vista previa (a través de la cámara). */
const throughCamera = (scene: Scene, t: Ticks, page: Point) => apply(invert(cameraMatrix(scene, t)), page);

/**
 * Trazo del lápiz tal como queda: la forma reconocida o la mano alzada estabilizada (con tinta si
 * está activa). `final` añade el tramo hasta donde se soltó el puntero.
 */
function drawnStroke(g: Extract<Gesture, { kind: 'draw' }>, options: ToolOptions, zoom: number, final = false) {
  if (g.snapped) {
    const duration = g.points[g.points.length - 1]!;
    // Las formas cerradas no afinan las puntas (se notaría la unión).
    return createStroke(packShape(g.snapped.points, duration), { ...options, streamline: 0.1, smoothing: 0.3 });
  }
  let points = g.points;
  if (final) {
    const t = points[points.length - 1]!;
    const tail = g.brush.catchUp(g.last.x, g.last.y, Math.max(1, options.size / 4));
    const pressure = points[points.length - 2]!;
    points = [...points, ...tail.flatMap((q) => [q.x, q.y, pressure, t])];
  }
  const done = finishFreehand(points, { ink: options.assist.ink, pen: g.pen, zoom, size: options.size });
  return createStroke(done.points, { ...options, taper: done.taper });
}

type Gesture =
  | { kind: 'pan'; start: Point; panX: number; panY: number }
  | {
      kind: 'draw';
      points: number[];
      t0: number;
      pen: boolean;
      /** Estabilizador: el trazo sigue a este pincel, no directamente al puntero. */
      brush: LazyBrush;
      /** Último punto real del puntero (el trazo lo alcanza al soltar). */
      last: Point;
      /** Dónde se quedó quieto el puntero (para las formas rápidas). */
      holdAt: Point;
      /** Forma reconocida al mantener quieto el puntero. */
      snapped: Recognized | null;
    }
  | { kind: 'erase'; last: Point; working: Map<string, Item[]> }
  | { kind: 'shape'; start: Point; current: Point }
  | {
      kind: 'move';
      start: Point;
      ids: string[];
      t0: Map<string, StaticTransform>;
      moved: boolean;
      box0: Rect | null;
      targetsX: number[];
      targetsY: number[];
    }
  | { kind: 'resize'; handle: Handle; ids: string[]; t0: Map<string, StaticTransform> }
  | { kind: 'rotate'; center: Point; startAngle: number; ids: string[]; t0: Map<string, StaticTransform> }
  | { kind: 'marquee'; start: Point; current: Point; base: string[] }
  | { kind: 'camera'; start: Point; mode: 'move' | 'zoom'; cam0: { x: number; y: number; zoom: number } }
  | PuppetGesture;

function isEditableTarget(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

/** Escena con los resultados provisionales de la goma aplicados (para verlos en vivo). */
function withReplacements(scene: Scene, working: Map<string, Item[]>): Scene {
  if (working.size === 0) return scene;
  return {
    ...scene,
    layers: scene.layers.map((l) =>
      l.items ? { ...l, items: l.items.flatMap((it) => working.get(it.id) ?? [it]) } : l,
    ),
  };
}

export function CanvasView({ project }: { project: Project }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [textTarget, setTextTarget] = useState<TextEditTarget | null>(null);
  const [cursor, setCursor] = useState('default');
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [tick, setTick] = useState(0); // fuerza redibujos durante gestos
  const cache = useRef(new PathCache());
  const gesture = useRef<Gesture | null>(null);
  const overrides = useRef(new Map<string, StaticTransform>());
  const guides = useRef<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const spaceHeld = useRef(false);
  const pointer = useRef<Point | null>(null);

  const tool = useEditor((s) => s.tool);
  const view = useEditor((s) => s.view);
  const selection = useEditor((s) => s.selection);
  const sceneId = useEditor((s) => s.sceneId);
  const showGrid = useEditor((s) => s.showGrid);
  const options = useEditor((s) => s.options);
  const editingTextId = useEditor((s) => s.editingTextId);
  const playhead = useEditor((s) => s.playhead);
  const playMode = useEditor((s) => s.preview || s.playing);
  const onion = useEditor((s) => s.onion);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const puppet = useEditor((s) => s.puppet);
  const mediaVersion = useMediaVersion((s) => s.v);
  const [cameraOverride, setCameraOverride] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const scene = project.scenes.find((s) => s.id === sceneId) ?? project.scenes[0]!;
  const { width: docW, height: docH, background, fps } = project.settings;
  const beats = useMemo(
    () => sceneBeats(project, scene.id, scene.duration).map((b) => b.t),
    [project, scene.id, scene.duration],
  );

  const redraw = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    void fontsReady().then(() => setFontsLoaded(true));
  }, []);

  // Tamaño del contenedor y ajuste automático de la vista.
  useLayoutEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (view.fit && size.w > 0) useEditor.getState().setView({ ...fitView(size.w, size.h, docW, docH), fit: true });
  }, [view.fit, size.w, size.h, docW, docH]);

  // Capa de escena.
  useEffect(() => {
    const canvas = sceneRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.panX, dpr * view.panY);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 16 / view.zoom;
    ctx.shadowOffsetY = 2 / view.zoom;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, docW, docH);
    ctx.restore();

    const g = gesture.current;
    const shown = g?.kind === 'erase' ? withReplacements(scene, g.working) : scene;
    const hidden = editingTextId ? new Set([editingTextId]) : undefined;
    const images = imageSourcesFor(project);

    if (playMode) {
      // Vista previa: lo que saldrá en el vídeo en el instante del cabezal, a través de la cámara.
      drawSceneFrame(ctx, project.settings, scene, playhead, cache.current, images, overrides.current, beats);
      return;
    }

    const list = evaluateScene(shown, playhead, { mode: 'edit', overrides: overrides.current, hidden });

    // Fuera de la hoja se ve atenuado (no saldrá en el vídeo).
    ctx.save();
    ctx.globalAlpha = 0.25;
    drawRenderList(ctx, list, cache.current, images);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, docW, docH);
    ctx.clip();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, docW, docH);
    // Papel cebolla: fotogramas anterior y siguiente de la capa de fotogramas activa.
    const active = scene.layers.find((l) => l.id === activeLayerId);
    if (onion && active?.kind === 'frames') {
      const cels = active.cels ?? [];
      const cel = celAt(active, playhead);
      const prev = [...cels].reverse().find((c) => c.start + c.duration <= (cel?.start ?? playhead));
      const next = cels.find((c) => c.start >= (cel ? cel.start + cel.duration : playhead + 1));
      for (const [neighbour, alpha] of [
        [prev, 0.28],
        [next, 0.14],
      ] as const) {
        if (!neighbour) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        const ghost: Scene = {
          ...scene,
          layers: [{ ...active, kind: 'vector', items: neighbour.items, cels: undefined }],
        };
        drawRenderList(ctx, evaluateScene(ghost, playhead, { mode: 'edit' }), cache.current, images);
        ctx.restore();
      }
    }
    drawRenderList(ctx, list, cache.current, images);
    if (showGrid) {
      const step = 60;
      ctx.strokeStyle = 'rgba(47,111,214,0.18)';
      ctx.lineWidth = 1 / view.zoom;
      ctx.beginPath();
      for (let x = step; x < docW; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, docH);
      }
      for (let y = step; y < docH; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(docW, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, [
    scene,
    view,
    size,
    background,
    docW,
    docH,
    showGrid,
    editingTextId,
    tick,
    fontsLoaded,
    playMode,
    playhead,
    onion,
    activeLayerId,
    project,
    mediaVersion,
    beats,
  ]);

  // Capa superpuesta: trazo en curso, selección, marco y cursor de goma.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.panX, dpr * view.panY);
    const px = 1 / view.zoom;
    const g = gesture.current;

    if (g?.kind === 'draw' && g.points.length) {
      const live = drawnStroke(g, options, view.zoom);
      ctx.globalAlpha = options.opacity;
      ctx.fillStyle = options.color;
      ctx.fill(outlineToPath(strokeOutline(live)));
      ctx.globalAlpha = 1;
      if (g.snapped) {
        // Qué forma se ha reconocido, junto al puntero.
        ctx.font = `600 ${13 * px}px sans-serif`;
        ctx.fillStyle = SELECTION_COLOR;
        ctx.fillText(SHAPE_LABELS[g.snapped.kind], g.holdAt.x + 12 * px, g.holdAt.y - 12 * px);
      }
    }
    if (g?.kind === 'shape') {
      const shape = SHAPE_TOOLS[tool]!;
      const s = createShape(shape, g.start.x, g.start.y, g.current.x - g.start.x, g.current.y - g.start.y, {
        stroke: options.color,
        strokeWidth: options.strokeWidth,
        fill: shape === 'rect' || shape === 'ellipse' ? options.fill : null,
        opacity: options.opacity,
      });
      drawRenderList(
        ctx as Ctx2D,
        [{ item: s, matrix: matrixFrom(transformOf(s)), opacity: 1, progress: 1 }],
        cache.current,
      );
    }
    if (g?.kind === 'marquee') {
      ctx.fillStyle = 'rgba(47,111,214,0.08)';
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = px;
      const x = Math.min(g.start.x, g.current.x);
      const y = Math.min(g.start.y, g.current.y);
      ctx.fillRect(x, y, Math.abs(g.current.x - g.start.x), Math.abs(g.current.y - g.start.y));
      ctx.strokeRect(x, y, Math.abs(g.current.x - g.start.x), Math.abs(g.current.y - g.start.y));
    }

    if (g?.kind === 'puppet' && g.samples.length > 1) {
      // Rastro de lo que se va grabando (en la vista previa, a través de la cámara).
      const cam = cameraMatrix(scene, playhead);
      ctx.save();
      ctx.strokeStyle = TRAIL_COLOR;
      ctx.lineWidth = 2.5 * px;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      g.samples.forEach((s, i) => {
        const q = apply(cam, { x: s.x + g.pivot.x, y: s.y + g.pivot.y });
        if (i) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      });
      ctx.stroke();
      ctx.restore();
    }
    if (!g && !playMode && !editingTextId && selection.length === 1) {
      // Trayectoria del elemento seleccionado si su posición está animada.
      const it = locateItem(scene, selection[0]!)?.item;
      const path = it && motionPath(it, playhead, ticksPerFrame(fps));
      if (path) {
        ctx.save();
        ctx.strokeStyle = PATH_COLOR;
        ctx.lineWidth = 1.5 * px;
        ctx.setLineDash([5 * px, 4 * px]);
        ctx.beginPath();
        path.points.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        for (const k of path.keys) {
          ctx.beginPath();
          ctx.arc(k.x, k.y, 3.5 * px, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (g?.kind === 'move' && (guides.current.x.length || guides.current.y.length)) {
      ctx.strokeStyle = GUIDE_COLOR;
      ctx.lineWidth = px;
      ctx.setLineDash([6 * px, 4 * px]);
      ctx.beginPath();
      for (const x of guides.current.x) {
        ctx.moveTo(x, -docH);
        ctx.lineTo(x, docH * 2);
      }
      for (const y of guides.current.y) {
        ctx.moveTo(-docW, y);
        ctx.lineTo(docW * 2, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!playMode && (tool === 'camera' || hasCamera(scene))) {
      const ct = resolveTransform(scene.camera, playhead);
      const c = cameraOverride ?? { x: ct.x, y: ct.y, zoom: ct.scaleX || 1 };
      ctx.save();
      ctx.strokeStyle = tool === 'camera' ? '#d9622b' : 'rgba(217,98,43,0.55)';
      ctx.lineWidth = (tool === 'camera' ? 2.5 : 1.5) * px;
      ctx.setLineDash([10 * px, 6 * px]);
      ctx.strokeRect(c.x, c.y, docW / c.zoom, docH / c.zoom);
      ctx.setLineDash([]);
      if (tool === 'camera') {
        const hs = HANDLE_PX * px;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(c.x + docW / c.zoom - hs / 2, c.y + docH / c.zoom - hs / 2, hs, hs);
        ctx.strokeRect(c.x + docW / c.zoom - hs / 2, c.y + docH / c.zoom - hs / 2, hs, hs);
        ctx.fillStyle = '#d9622b';
        ctx.font = `${13 * px}px sans-serif`;
        ctx.fillText(`Cámara · ${Math.round(c.zoom * 100)} %`, c.x + 6 * px, c.y + 18 * px);
      }
      ctx.restore();
    }
    const geo = editingTextId || playMode ? null : selectionGeometry(scene, selection, overrides.current, playhead);
    if (geo) {
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = px;
      if (!geo.single)
        for (const it of geo.items) {
          const b = worldBounds(it, playhead, matrixFrom(transformOf(it, overrides.current, playhead)));
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
      ctx.lineWidth = 1.5 * px;
      ctx.beginPath();
      geo.corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
      ctx.closePath();
      ctx.stroke();
      if (tool === 'select' && !puppet && (!g || g.kind === 'resize' || g.kind === 'rotate')) {
        const rot = rotateHandlePoint(geo.corners, ROTATE_OFFSET_PX * px);
        const top = handlePoint(geo.corners, 'n');
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(rot.x, rot.y);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rot.x, rot.y, (HANDLE_PX / 2 + 1) * px, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (const h of HANDLES) {
          const p = handlePoint(geo.corners, h);
          const s = HANDLE_PX * px;
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
          ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
        }
      }
    }
    if (tool === 'eraser' && pointer.current) {
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.arc(pointer.current.x, pointer.current.y, options.eraserSize / 2 / view.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [
    scene,
    selection,
    view,
    size,
    tool,
    options,
    editingTextId,
    tick,
    docW,
    docH,
    playMode,
    playhead,
    cameraOverride,
    puppet,
    fps,
  ]);

  const scenePoint = (e: { clientX: number; clientY: number }): Point => {
    const r = overlayRef.current!.getBoundingClientRect();
    return toScene(useEditor.getState().view, { x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const hitHandle = (p: Point): Handle | 'rotate' | null => {
    const { selection: sel, tool: t, view: v, puppet: grabbing } = useEditor.getState();
    if (t !== 'select' || grabbing || !sel.length) return null;
    const geo = selectionGeometry(scene, sel, undefined, useEditor.getState().playhead);
    if (!geo) return null;
    const tol = (HANDLE_PX / 2 + 3) / v.zoom;
    const rot = rotateHandlePoint(geo.corners, ROTATE_OFFSET_PX / v.zoom);
    if (Math.hypot(p.x - rot.x, p.y - rot.y) <= tol + 2 / v.zoom) return 'rotate';
    for (const h of HANDLES) {
      const hp = handlePoint(geo.corners, h);
      if (Math.abs(p.x - hp.x) <= tol && Math.abs(p.y - hp.y) <= tol) return h;
    }
    return null;
  };

  const topItemAt = (p: Point): Item | null => {
    const t = useEditor.getState().playhead;
    const items = selectableItems(scene, t);
    const tol = HIT_TOLERANCE_PX / useEditor.getState().view.zoom;
    for (let i = items.length - 1; i >= 0; i--) if (hitItem(items[i]!, p, tol, t)) return items[i]!;
    return null;
  };

  const startTransformGesture = (ids: string[]) => {
    const t0 = new Map<string, StaticTransform>();
    const sc = currentScene();
    for (const id of ids) {
      const it = sc && locateItem(sc, id)?.item;
      if (it) t0.set(id, transformOf(it, undefined, useEditor.getState().playhead));
    }
    return t0;
  };

  // Formas rápidas: si el puntero se queda quieto un momento mientras se dibuja, se intenta
  // reconocer la forma del trazo.
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const armHold = () => {
    clearTimeout(holdTimer.current);
    if (!useEditor.getState().options.assist.quickShapes) return;
    holdTimer.current = setTimeout(() => {
      const g = gesture.current;
      if (g?.kind !== 'draw' || g.snapped) return;
      const pts: Point[] = [];
      for (let i = 0; i < g.points.length; i += 4) pts.push({ x: g.points[i]!, y: g.points[i + 1]! });
      pts.push(g.last);
      g.snapped = recognizeShape(pts);
      if (g.snapped) redraw();
    }, HOLD_MS);
  };

  /** Lo que se agarra al animar arrastrando: lo que hay bajo el puntero o el seleccionado (por dentro de su caja). */
  const puppetTarget = (p: Point): Item | null => {
    const { selection: sel, playhead: t } = useEditor.getState();
    const selected = sel.length === 1 ? locateItem(scene, sel[0]!)?.item : undefined;
    return (
      topItemAt(p) ?? (selected && rectsIntersect(worldBounds(selected, t), { ...p, w: 0, h: 0 }) ? selected : null)
    );
  };

  /** Recoge la posición del elemento en `t` según el puntero y la muestra en vivo. */
  const samplePuppet = (g: PuppetGesture, t: Ticks) => {
    const w = throughCamera(g.scene, t, g.page);
    const x = g.base.x + w.x - g.from.x;
    const y = g.base.y + w.y - g.from.y;
    g.samples.push({ t, x, y });
    overrides.current = new Map([[g.item.id, { ...transformOf(g.item, undefined, t), x, y }]]);
  };

  /** Termina «Animar arrastrando»: guarda el recorrido (si hubo movimiento) o lo descarta. */
  const endPuppet = (g: PuppetGesture, commit: boolean) => {
    if (gesture.current !== g) return;
    gesture.current = null;
    g.unsub();
    overrides.current = new Map();
    const ed = useEditor.getState();
    ed.setPreview(false);
    if (ed.sceneId !== g.scene.id) goToScene(g.scene.id);
    const saved = commit && g.moved && commitMotion(g.scene.id, g.item.id, g.samples);
    // Si se guardó, el cabezal queda al final: se puede seguir grabando desde ahí.
    useEditor.getState().setPlayhead(saved ? g.samples[g.samples.length - 1]!.t : g.t0);
    useEditor.getState().select([g.item.id]);
    redraw();
  };

  const startPuppet = (e: React.PointerEvent): boolean => {
    const ed = useEditor.getState();
    const sc = currentScene();
    if (!sc) return false;
    const page = scenePoint(e);
    const t0 = ed.playhead;
    const hit = puppetTarget(ed.preview || ed.playing ? throughCamera(sc, t0, page) : page);
    if (!hit) return false;
    if (ed.playing) ed.setPlaying(false);
    ed.select([hit.id]);
    if (t0 >= sc.duration - ticksPerFrame(fps)) {
      useApp.getState().notify({
        kind: 'info',
        text: 'El cabezal está al final de la escena. Llévalo antes (o alarga la escena) para animar arrastrando.',
      });
      return true;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = transformOf(hit, undefined, t0);
    const box = worldBounds(hit, t0);
    const g: PuppetGesture = {
      kind: 'puppet',
      item: hit,
      scene: sc,
      t0,
      base: { x: base.x, y: base.y },
      from: throughCamera(sc, t0, page),
      page,
      page0: page,
      pivot: { x: box.x + box.w / 2 - base.x, y: box.y + box.h / 2 - base.y },
      samples: [{ t: t0, x: base.x, y: base.y }],
      moved: false,
      unsub: () => undefined,
    };
    gesture.current = g;
    setCursor('grabbing');
    ed.setPreview(true);
    ed.setPlaying(true);
    g.unsub = useEditor.subscribe((s, prev) => {
      if (gesture.current !== g) return;
      if (s.sceneId !== g.scene.id || !s.playing) {
        // Se acabó la escena (o el vídeo, o se detuvo): el recorrido se cierra ahí.
        if (s.sceneId !== g.scene.id) samplePuppet(g, g.scene.duration);
        queueMicrotask(() => endPuppetRef.current(g, true));
        return;
      }
      if (s.playhead !== prev.playhead) samplePuppet(g, s.playhead);
    });
    redraw();
    return true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (gesture.current || textTarget) return;
    const ed0 = useEditor.getState();
    if (ed0.puppet && ed0.tool === 'select' && e.button === 0 && !spaceHeld.current && startPuppet(e)) return;
    // Interactuar con el lienzo vuelve al modo edición.
    if (useEditor.getState().preview || useEditor.getState().playing) useEditor.getState().setPreview(false);
    const p = scenePoint(e);
    const ed = useEditor.getState();
    const panning = e.button === 1 || ed.tool === 'hand' || spaceHeld.current;
    if (e.button !== 0 && !panning) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (panning) {
      gesture.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, panX: ed.view.panX, panY: ed.view.panY };
      setPanning(true);
      return;
    }
    switch (ed.tool) {
      case 'camera': {
        const ct = resolveTransform(scene.camera, ed.playhead);
        const cam0 = { x: ct.x, y: ct.y, zoom: ct.scaleX || 1 };
        const corner = { x: cam0.x + docW / cam0.zoom, y: cam0.y + docH / cam0.zoom };
        const near = Math.hypot(p.x - corner.x, p.y - corner.y) <= (HANDLE_PX + 6) / ed.view.zoom;
        gesture.current = { kind: 'camera', start: p, mode: near ? 'zoom' : 'move', cam0 };
        setCameraOverride(cam0);
        break;
      }
      case 'pencil': {
        if (!writableActiveLayer()) return;
        const pen = e.pointerType === 'pen';
        const brush = new LazyBrush(STABILIZER_PX[ed.options.assist.stabilizer] / ed.view.zoom);
        brush.update(p.x, p.y);
        gesture.current = {
          kind: 'draw',
          points: [p.x, p.y, pen ? Math.max(0.05, e.pressure) : -1, 0],
          t0: e.timeStamp,
          pen,
          brush,
          last: p,
          holdAt: p,
          snapped: null,
        };
        armHold();
        break;
      }
      case 'eraser':
        gesture.current = { kind: 'erase', last: p, working: new Map() };
        eraseSegment(p, p);
        break;
      case 'rect':
      case 'ellipse':
      case 'line':
      case 'arrow':
        if (!writableActiveLayer()) return;
        gesture.current = { kind: 'shape', start: p, current: p };
        break;
      case 'text': {
        // Evita que el clic quite el foco al cuadro de texto que se va a abrir.
        e.preventDefault();
        const hit = topItemAt(p);
        if (hit?.type === 'text') setTextTarget({ kind: 'edit', id: hit.id });
        else if (writableActiveLayer()) setTextTarget({ kind: 'new', x: p.x, y: p.y });
        return;
      }
      case 'select': {
        const handle = hitHandle(p);
        if (handle === 'rotate') {
          const geo = selectionGeometry(scene, ed.selection, undefined, ed.playhead)!;
          gesture.current = {
            kind: 'rotate',
            center: geo.center,
            startAngle: Math.atan2(p.y - geo.center.y, p.x - geo.center.x),
            ids: ed.selection,
            t0: startTransformGesture(ed.selection),
          };
          break;
        }
        if (handle) {
          gesture.current = { kind: 'resize', handle, ids: ed.selection, t0: startTransformGesture(ed.selection) };
          break;
        }
        const hit = topItemAt(p);
        if (hit) {
          let sel = ed.selection;
          if (e.shiftKey) sel = sel.includes(hit.id) ? sel.filter((x) => x !== hit.id) : [...sel, hit.id];
          else if (!sel.includes(hit.id)) sel = [hit.id];
          ed.select(sel);
          if (e.detail >= 2 && hit.type === 'text') {
            setTextTarget({ kind: 'edit', id: hit.id });
            return;
          }
          const t0 = startTransformGesture(sel);
          const sc = currentScene()!;
          const box0 = unionRects(
            sel
              .map((id) => locateItem(sc, id)?.item)
              .filter((i): i is Item => !!i)
              .map((i) => worldBounds(i, ed.playhead, matrixFrom(t0.get(i.id)!))),
          );
          const others = selectableItems(sc, ed.playhead)
            .filter((i) => !sel.includes(i.id))
            .map((i) => worldBounds(i, ed.playhead));
          gesture.current = {
            kind: 'move',
            start: p,
            ids: sel,
            t0,
            moved: false,
            box0,
            targetsX: [0, docW / 2, docW, ...others.flatMap((b) => [b.x, b.x + b.w / 2, b.x + b.w])],
            targetsY: [0, docH / 2, docH, ...others.flatMap((b) => [b.y, b.y + b.h / 2, b.y + b.h])],
          };
        } else {
          gesture.current = { kind: 'marquee', start: p, current: p, base: e.shiftKey ? ed.selection : [] };
          if (!e.shiftKey) ed.select([]);
        }
        break;
      }
    }
    redraw();
  };

  const eraseSegment = (a: Point, b: Point) => {
    const g = gesture.current;
    if (g?.kind !== 'erase') return;
    const radius = useEditor.getState().options.eraserSize / 2 / useEditor.getState().view.zoom;
    const sc = currentScene();
    if (!sc) return;
    const current = selectableItems(withReplacements(sc, g.working), useEditor.getState().playhead);
    const { replacements } = eraseItems(current, [a, b], radius);
    if (replacements.size === 0) return;
    // Traduce los reemplazos de piezas intermedias a su elemento original.
    const originalOf = new Map<string, string>();
    for (const [orig, pieces] of g.working) for (const piece of pieces) originalOf.set(piece.id, orig);
    for (const [id, pieces] of replacements) {
      const orig = originalOf.get(id) ?? id;
      const prev = g.working.get(orig);
      g.working.set(orig, prev ? prev.flatMap((x) => (x.id === id ? pieces : [x])) : pieces);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = scenePoint(e);
    pointer.current = p;
    const g = gesture.current;
    const ed = useEditor.getState();
    if (!g) {
      if (ed.tool === 'select' && ed.puppet) setCursor(!playMode && puppetTarget(p) ? 'grab' : 'default');
      else if (ed.tool === 'select') {
        const h = hitHandle(p);
        const geo = h && selectionGeometry(scene, ed.selection, undefined, ed.playhead);
        setCursor(
          h === 'rotate'
            ? 'grab'
            : h && geo
              ? cursorForHandle(h, geo.single ? transformOf(geo.items[0]!, undefined, ed.playhead).rotation : 0)
              : topItemAt(p)
                ? 'move'
                : 'default',
        );
      } else if (ed.tool === 'eraser') redraw();
      return;
    }
    switch (g.kind) {
      case 'puppet':
        // La posición se recoge en cada fotograma de la reproducción.
        g.page = p;
        if (Math.hypot(p.x - g.page0.x, p.y - g.page0.y) * ed.view.zoom > 2) g.moved = true;
        return;
      case 'pan':
        ed.setView({ panX: g.panX + e.clientX - g.start.x, panY: g.panY + e.clientY - g.start.y, fit: false });
        return;
      case 'draw': {
        const moved = Math.hypot(p.x - g.holdAt.x, p.y - g.holdAt.y) * ed.view.zoom > HOLD_SLOP_PX;
        // Con una forma reconocida, solo un movimiento claro vuelve a la mano alzada.
        if (g.snapped && Math.hypot(p.x - g.holdAt.x, p.y - g.holdAt.y) * ed.view.zoom < HOLD_SLOP_PX * 4) return;
        if (moved || g.snapped) {
          g.snapped = null;
          g.holdAt = p;
          armHold();
        }
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        for (const ev of events.length ? events : [e.nativeEvent]) {
          const q = scenePoint(ev);
          g.last = q;
          const b = g.brush.update(q.x, q.y);
          if (b) g.points.push(b.x, b.y, g.pen ? Math.max(0.05, ev.pressure) : -1, Math.round(ev.timeStamp - g.t0));
        }
        break;
      }
      case 'erase':
        eraseSegment(g.last, p);
        g.last = p;
        break;
      case 'shape': {
        let q = p;
        if (e.shiftKey) {
          const dx = p.x - g.start.x;
          const dy = p.y - g.start.y;
          if (tool === 'line' || tool === 'arrow') {
            const ang = snapAngle((Math.atan2(dy, dx) * 180) / Math.PI, 45) * (Math.PI / 180);
            const len = Math.hypot(dx, dy);
            q = { x: g.start.x + Math.cos(ang) * len, y: g.start.y + Math.sin(ang) * len };
          } else {
            const m = Math.max(Math.abs(dx), Math.abs(dy));
            q = { x: g.start.x + Math.sign(dx || 1) * m, y: g.start.y + Math.sign(dy || 1) * m };
          }
        }
        g.current = q;
        break;
      }
      case 'move': {
        let dx = p.x - g.start.x;
        let dy = p.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) * ed.view.zoom < 3) return;
        g.moved = true;
        guides.current = { x: [], y: [] };
        if (ed.snap && !e.altKey && g.box0) {
          // Ajuste magnético de bordes y centros a la hoja y a otros elementos.
          const tol = SNAP_PX / ed.view.zoom;
          const snapAxis = (start: number, size: number, d: number, targets: number[]) => {
            let best: { delta: number; line: number } | null = null;
            for (const edge of [start, start + size / 2, start + size]) {
              for (const t of targets) {
                const delta = t - (edge + d);
                if (Math.abs(delta) <= tol && (!best || Math.abs(delta) < Math.abs(best.delta)))
                  best = { delta, line: t };
              }
            }
            return best;
          };
          const sx = snapAxis(g.box0.x, g.box0.w, dx, g.targetsX);
          const sy = snapAxis(g.box0.y, g.box0.h, dy, g.targetsY);
          if (sx) {
            dx += sx.delta;
            guides.current.x.push(sx.line);
          }
          if (sy) {
            dy += sy.delta;
            guides.current.y.push(sy.line);
          }
        }
        overrides.current = new Map([...g.t0].map(([id, t]) => [id, { ...t, x: t.x + dx, y: t.y + dy }]));
        break;
      }
      case 'resize': {
        const sc = currentScene()!;
        if (g.ids.length === 1) {
          const it = locateItem(sc, g.ids[0]!)?.item;
          if (it) overrides.current = new Map([[it.id, resizeSingle(it, g.t0.get(it.id)!, g.handle, p, e.shiftKey)]]);
        } else {
          const box = selectionGeometry(sc, g.ids, undefined, ed.playhead)!.box;
          const next = resizeGroup([...g.t0.values()], box, g.handle, p);
          overrides.current = new Map([...g.t0.keys()].map((id, i) => [id, next[i]!]));
        }
        break;
      }
      case 'rotate': {
        let deg = ((Math.atan2(p.y - g.center.y, p.x - g.center.x) - g.startAngle) * 180) / Math.PI;
        if (e.shiftKey) deg = snapAngle(deg);
        const next = rotateGroup([...g.t0.values()], g.center, deg);
        overrides.current = new Map([...g.t0.keys()].map((id, i) => [id, next[i]!]));
        break;
      }
      case 'camera': {
        if (g.mode === 'move')
          setCameraOverride({ ...g.cam0, x: g.cam0.x + p.x - g.start.x, y: g.cam0.y + p.y - g.start.y });
        else {
          const width = Math.max(docW * 0.1, p.x - g.cam0.x);
          setCameraOverride({ ...g.cam0, zoom: Math.min(10, Math.max(0.5, docW / width)) });
        }
        break;
      }
      case 'marquee': {
        g.current = p;
        const r = {
          x: Math.min(g.start.x, p.x),
          y: Math.min(g.start.y, p.y),
          w: Math.abs(p.x - g.start.x),
          h: Math.abs(p.y - g.start.y),
        };
        const inside = selectableItems(scene, ed.playhead)
          .filter((it) => rectsIntersect(worldBounds(it, ed.playhead), r))
          .map((it) => it.id);
        ed.select([...new Set([...g.base, ...inside])]);
        break;
      }
    }
    redraw();
  };

  const finishGesture = () => {
    const g = gesture.current;
    if (g?.kind === 'puppet') return endPuppet(g, true);
    gesture.current = null;
    if (!g) return;
    const ed = useEditor.getState();
    switch (g.kind) {
      case 'pan':
        setPanning(false);
        break;
      case 'draw':
        clearTimeout(holdTimer.current);
        addToActiveLayer(drawnStroke(g, ed.options, ed.view.zoom, true), g.snapped ? 'Dibujar forma' : 'Dibujar');
        break;
      case 'erase':
        commitErase(g.working);
        break;
      case 'shape': {
        const shape = SHAPE_TOOLS[ed.tool]!;
        let { x, y } = g.start;
        let w = g.current.x - g.start.x;
        let h = g.current.y - g.start.y;
        if (Math.hypot(w, h) * ed.view.zoom < 4) {
          // Un clic sin arrastrar crea la forma con un tamaño razonable.
          const d = shape === 'line' || shape === 'arrow' ? { w: 200, h: 0 } : { w: 200, h: 140 };
          w = d.w;
          h = d.h;
          x -= w / 2;
          y -= h / 2;
        }
        const s = createShape(shape, x, y, w, h, {
          stroke: ed.options.color,
          strokeWidth: ed.options.strokeWidth,
          fill: shape === 'rect' || shape === 'ellipse' ? ed.options.fill : null,
          opacity: ed.options.opacity,
        });
        if (addToActiveLayer(s, 'Añadir forma')) {
          ed.setTool('select');
          ed.select([s.id]);
        }
        break;
      }
      case 'move':
        if (g.moved) commitTransforms('Mover', overrides.current);
        break;
      case 'resize':
        commitTransforms('Redimensionar', overrides.current);
        break;
      case 'rotate':
        commitTransforms('Rotar', overrides.current);
        break;
      case 'marquee':
        break;
      case 'camera':
        if (cameraOverride) commitCamera(cameraOverride);
        setCameraOverride(null);
        break;
    }
    overrides.current = new Map();
    guides.current = { x: [], y: [] };
    redraw();
  };

  // Esc cancela «Animar arrastrando» (sin guardar nada); al desmontar se suelta la suscripción.
  const endPuppetRef = useRef(endPuppet);
  useEffect(() => {
    endPuppetRef.current = endPuppet;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gesture.current;
      if (g?.kind !== 'puppet' || e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      endPuppetRef.current(g, false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const g = gesture.current;
      if (g?.kind === 'puppet') g.unsub();
    };
  }, []);

  // Rueda: Ctrl + rueda para zoom alrededor del cursor; sin modificador, desplazar.
  useEffect(() => {
    const el = overlayRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ed = useEditor.getState();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        ed.setView(zoomAt(ed.view, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top }));
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        ed.setView({ panX: ed.view.panX - dx, panY: ed.view.panY - dy, fit: false });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Espacio mantenido = mano temporal.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditableTarget(e.target)) {
        e.preventDefault();
        spaceHeld.current = true;
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        setSpaceDown(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const toolCursor: Record<Tool, string> = {
    select: cursor,
    pencil: 'crosshair',
    eraser: 'none',
    rect: 'crosshair',
    ellipse: 'crosshair',
    line: 'crosshair',
    arrow: 'crosshair',
    text: 'text',
    hand: 'grab',
    camera: 'move',
  };
  const effectiveCursor = panning ? 'grabbing' : spaceDown ? 'grab' : toolCursor[tool];

  // Teclado: con el lienzo enfocado, Tab y Mayús+Tab recorren los elementos seleccionables. Al pasar
  // del último (o del primero hacia atrás) el foco sale del lienzo con normalidad.
  const onCanvasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey || e.target !== e.currentTarget) return;
    const ed = useEditor.getState();
    const items = selectableItems(scene, ed.playhead);
    const current = items.findIndex((i) => i.id === ed.selection[0]);
    const next = e.shiftKey ? (current < 0 ? items.length - 1 : current - 1) : current + 1;
    if (next < 0 || next >= items.length) return;
    e.preventDefault();
    if (ed.tool !== 'select') ed.setTool('select');
    ed.select([items[next]!.id]);
  };
  const selectable = selectableItems(scene, playhead);
  const selIndex = selection.length === 1 ? selectable.findIndex((i) => i.id === selection[0]) : -1;
  const announcement =
    selection.length > 1
      ? `${selection.length} elementos seleccionados`
      : selIndex >= 0
        ? `${itemName(selectable[selIndex]!)}, ${selIndex + 1} de ${selectable.length}`
        : '';

  return (
    <div
      className="canvas-host"
      ref={containerRef}
      data-testid="canvas-host"
      tabIndex={0}
      role="application"
      aria-roledescription="lienzo"
      aria-label="Lienzo de la escena. Tab y Mayús+Tab recorren los elementos; flechas para moverlos; Supr para eliminarlos."
      onKeyDown={onCanvasKeyDown}
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <canvas
        ref={sceneRef}
        className="canvas-layer"
        data-testid="scene-canvas"
        style={{ width: size.w, height: size.h }}
      />
      <canvas
        ref={overlayRef}
        className="canvas-layer"
        data-testid="overlay-canvas"
        style={{ width: size.w, height: size.h, cursor: effectiveCursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(ASSET_MIME) || hasFiles(e.dataTransfer)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          if (hasFiles(e.dataTransfer)) {
            // Imágenes desde el explorador: en el punto donde se sueltan.
            e.preventDefault();
            void importDroppedFiles([...e.dataTransfer.files], { point: scenePoint(e) });
            return;
          }
          const asset = LIBRARY.find((a) => a.id === e.dataTransfer.getData(ASSET_MIME));
          if (!asset) return;
          e.preventDefault();
          insertAsset(asset, project, scenePoint(e));
        }}
        onPointerLeave={() => {
          pointer.current = null;
          if (useEditor.getState().tool === 'eraser') redraw();
        }}
      />
      {textTarget && (
        <TextEditor
          key={textTarget.kind === 'edit' ? textTarget.id : `${textTarget.x},${textTarget.y}`}
          target={textTarget}
          onDone={() => setTextTarget(null)}
        />
      )}
    </div>
  );
}

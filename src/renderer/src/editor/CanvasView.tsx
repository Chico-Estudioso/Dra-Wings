import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createShape, createStroke } from '@core/model/factory';
import { eraseItems } from '@core/edit/erase';
import { locateItem, selectableItems, translateItems } from '@core/edit/ops';
import { hitItem, rectsIntersect, worldBounds } from '@core/geometry/items';
import { resizeGroup, resizeSingle, rotateGroup, snapAngle, type Handle } from '@core/geometry/manipulate';
import { matrixFrom, type Point, type StaticTransform } from '@core/geometry/matrix';
import { drawRenderList, outlineToPath, PathCache, type Ctx2D } from '@core/render/draw';
import { evaluateScene } from '@core/render/evaluate';
import { strokeOutline } from '@core/render/stroke-outline';
import type { Item, Project, Scene } from '@core/model/types';
import {
  addToActiveLayer,
  commitErase,
  commitTransforms,
  currentScene,
  editScene,
  writableActiveLayer,
} from './actions';
import { SHAPE_TOOLS, useEditor, type Tool } from './editor-store';
import { fontsReady } from './fonts';
import { cursorForHandle, handlePoint, HANDLES, rotateHandlePoint, selectionGeometry, transformOf } from './selection';
import { fitView, toScene, zoomAt } from './view';
import { TextEditor, type TextEditTarget } from './TextEditor';

const HANDLE_PX = 9;
const ROTATE_OFFSET_PX = 28;
const HIT_TOLERANCE_PX = 6;
const SELECTION_COLOR = '#2f6fd6';

type Gesture =
  | { kind: 'pan'; start: Point; panX: number; panY: number }
  | { kind: 'draw'; points: number[]; t0: number; pen: boolean }
  | { kind: 'erase'; last: Point; working: Map<string, Item[]> }
  | { kind: 'shape'; start: Point; current: Point }
  | { kind: 'move'; start: Point; ids: string[]; t0: Map<string, StaticTransform>; moved: boolean }
  | { kind: 'resize'; handle: Handle; ids: string[]; t0: Map<string, StaticTransform> }
  | { kind: 'rotate'; center: Point; startAngle: number; ids: string[]; t0: Map<string, StaticTransform> }
  | { kind: 'marquee'; start: Point; current: Point; base: string[] };

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
  const spaceHeld = useRef(false);
  const pointer = useRef<Point | null>(null);

  const tool = useEditor((s) => s.tool);
  const view = useEditor((s) => s.view);
  const selection = useEditor((s) => s.selection);
  const sceneId = useEditor((s) => s.sceneId);
  const showGrid = useEditor((s) => s.showGrid);
  const options = useEditor((s) => s.options);
  const editingTextId = useEditor((s) => s.editingTextId);
  const scene = project.scenes.find((s) => s.id === sceneId) ?? project.scenes[0]!;
  const { width: docW, height: docH, background } = project.settings;

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
    const list = evaluateScene(shown, 0, { mode: 'edit', overrides: overrides.current, hidden });

    // Fuera de la hoja se ve atenuado (no saldrá en el vídeo).
    ctx.save();
    ctx.globalAlpha = 0.25;
    drawRenderList(ctx, list, cache.current);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, docW, docH);
    ctx.clip();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, docW, docH);
    drawRenderList(ctx, list, cache.current);
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
  }, [scene, view, size, background, docW, docH, showGrid, editingTextId, tick, fontsLoaded]);

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
      const live = createStroke(g.points, options);
      ctx.globalAlpha = options.opacity;
      ctx.fillStyle = options.color;
      ctx.fill(outlineToPath(strokeOutline(live)));
      ctx.globalAlpha = 1;
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

    const geo = editingTextId ? null : selectionGeometry(scene, selection, overrides.current);
    if (geo) {
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = px;
      if (!geo.single)
        for (const it of geo.items) {
          const b = worldBounds(it, 0, matrixFrom(transformOf(it, overrides.current)));
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
      ctx.lineWidth = 1.5 * px;
      ctx.beginPath();
      geo.corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
      ctx.closePath();
      ctx.stroke();
      if (tool === 'select' && (!g || g.kind === 'resize' || g.kind === 'rotate')) {
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
  }, [scene, selection, view, size, tool, options, editingTextId, tick]);

  const scenePoint = (e: { clientX: number; clientY: number }): Point => {
    const r = overlayRef.current!.getBoundingClientRect();
    return toScene(useEditor.getState().view, { x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const hitHandle = (p: Point): Handle | 'rotate' | null => {
    const { selection: sel, tool: t, view: v } = useEditor.getState();
    if (t !== 'select' || !sel.length) return null;
    const geo = selectionGeometry(scene, sel);
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
    const items = selectableItems(scene);
    const tol = HIT_TOLERANCE_PX / useEditor.getState().view.zoom;
    for (let i = items.length - 1; i >= 0; i--) if (hitItem(items[i]!, p, tol)) return items[i]!;
    return null;
  };

  const startTransformGesture = (ids: string[]) => {
    const t0 = new Map<string, StaticTransform>();
    const sc = currentScene();
    for (const id of ids) {
      const it = sc && locateItem(sc, id)?.item;
      if (it) t0.set(id, transformOf(it));
    }
    return t0;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (gesture.current || textTarget) return;
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
      case 'pencil': {
        if (!writableActiveLayer()) return;
        const pen = e.pointerType === 'pen';
        gesture.current = {
          kind: 'draw',
          points: [p.x, p.y, pen ? Math.max(0.05, e.pressure) : -1, 0],
          t0: e.timeStamp,
          pen,
        };
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
          const geo = selectionGeometry(scene, ed.selection)!;
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
          gesture.current = { kind: 'move', start: p, ids: sel, t0: startTransformGesture(sel), moved: false };
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
    const current = selectableItems(withReplacements(sc, g.working));
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
      if (ed.tool === 'select') {
        const h = hitHandle(p);
        const geo = h && selectionGeometry(scene, ed.selection);
        setCursor(
          h === 'rotate'
            ? 'grab'
            : h && geo
              ? cursorForHandle(h, geo.single ? transformOf(geo.items[0]!).rotation : 0)
              : topItemAt(p)
                ? 'move'
                : 'default',
        );
      } else if (ed.tool === 'eraser') redraw();
      return;
    }
    switch (g.kind) {
      case 'pan':
        ed.setView({ panX: g.panX + e.clientX - g.start.x, panY: g.panY + e.clientY - g.start.y, fit: false });
        return;
      case 'draw': {
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        for (const ev of events.length ? events : [e.nativeEvent]) {
          const q = scenePoint(ev);
          g.points.push(q.x, q.y, g.pen ? Math.max(0.05, ev.pressure) : -1, Math.round(ev.timeStamp - g.t0));
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
        const dx = p.x - g.start.x;
        const dy = p.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) * ed.view.zoom < 3) return;
        g.moved = true;
        overrides.current = new Map([...g.t0].map(([id, t]) => [id, { ...t, x: t.x + dx, y: t.y + dy }]));
        break;
      }
      case 'resize': {
        const sc = currentScene()!;
        if (g.ids.length === 1) {
          const it = locateItem(sc, g.ids[0]!)?.item;
          if (it) overrides.current = new Map([[it.id, resizeSingle(it, g.t0.get(it.id)!, g.handle, p, e.shiftKey)]]);
        } else {
          const box = selectionGeometry(sc, g.ids)!.box;
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
      case 'marquee': {
        g.current = p;
        const r = {
          x: Math.min(g.start.x, p.x),
          y: Math.min(g.start.y, p.y),
          w: Math.abs(p.x - g.start.x),
          h: Math.abs(p.y - g.start.y),
        };
        const inside = selectableItems(scene)
          .filter((it) => rectsIntersect(worldBounds(it), r))
          .map((it) => it.id);
        ed.select([...new Set([...g.base, ...inside])]);
        break;
      }
    }
    redraw();
  };

  const finishGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const ed = useEditor.getState();
    switch (g.kind) {
      case 'pan':
        setPanning(false);
        break;
      case 'draw':
        addToActiveLayer(createStroke(g.points, ed.options), 'Dibujar');
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
        if (g.moved) {
          const any = overrides.current.values().next().value;
          const first = g.t0.values().next().value;
          if (any && first) {
            const dx = any.x - first.x;
            const dy = any.y - first.y;
            editScene('Mover', (scene) => translateItems(scene, g.ids, dx, dy));
          }
        }
        break;
      case 'resize':
        commitTransforms('Redimensionar', overrides.current);
        break;
      case 'rotate':
        commitTransforms('Rotar', overrides.current);
        break;
      case 'marquee':
        break;
    }
    overrides.current = new Map();
    redraw();
  };

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
  };
  const effectiveCursor = panning ? 'grabbing' : spaceDown ? 'grab' : toolCursor[tool];

  return (
    <div className="canvas-host" ref={containerRef} data-testid="canvas-host">
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

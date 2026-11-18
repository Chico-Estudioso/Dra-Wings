// Evaluación de una escena en un instante: lista plana de lo que hay que dibujar (ver ANIMATION_ENGINE.md).
import { childrenAt } from '../anim/swaps';
import { lifeMatrix } from '../anim/life';
import { stretchMatrix, TRAIL } from '../anim/elastic';
import { valueAt } from '../anim/animated';
import {
  matrixFrom,
  multiply,
  resolveTransform,
  scale,
  translate,
  type Mat,
  type StaticTransform,
} from '../geometry/matrix';
import { POINT_STRIDE } from '../geometry/items';
import type { Item, Scene } from '../model/types';
import { layerItemsAt } from '../edit/ops';
import type { Ticks } from '../time/ticks';

export interface RenderItem {
  item: Item;
  matrix: Mat;
  opacity: number;
  /** Progreso de dibujo (0..1): trazos parciales, contorno de formas, letras de un texto. */
  progress: number;
  /** Solo formas: proporción del relleno ya visible (0..1). */
  fill?: number;
}

export interface EvaluateOptions {
  /**
   * 'edit': todo visible y completo, con las transformaciones del instante (para editar).
   * 'play': respeta entradas, salidas, animaciones de aparición y keyframes (vista previa y vídeo).
   */
  mode: 'edit' | 'play';
  /** Transformaciones provisionales (por ejemplo, mientras se arrastra). */
  overrides?: ReadonlyMap<string, StaticTransform>;
  /** Golpes de la música en el tiempo de la escena (vida «al ritmo»). */
  beats?: readonly Ticks[];
  /** Intensidad de la elasticidad (0: rígido). */
  elastic?: number;
  /** Ancho de la hoja / 1920: las velocidades se miden igual en cualquier formato. */
  unit?: number;
  /** Elementos que no se dibujan (por ejemplo, el texto que se está editando). */
  hidden?: ReadonlySet<string>;
}

const clamp01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
const easeOutBack = (u: number) => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2;
const easeInCubic = (u: number) => u * u * u;

/** Parte de la entrada de un dibujo dedicada al contorno; el resto colorea los rellenos. */
export const OUTLINE_SHARE = 0.75;

interface Appearance {
  visible: boolean;
  opacity: number;
  /** Progreso de la entrada «dibujar» (1 si no se dibuja). */
  draw: number;
  /** Escala multiplicativa por «pop». */
  pop: number;
}

/** Estado de aparición de un elemento en el instante `t` (relativo a la escena). */
export function appearance(item: Item, t: Ticks): Appearance {
  if (t < item.in || (item.out !== undefined && t >= item.out)) return { visible: false, opacity: 0, draw: 0, pop: 0 };
  let opacity = 1;
  let draw = 1;
  let pop = 1;
  const enter = item.enter;
  if (enter && enter.kind !== 'none') {
    const e = enter.duration > 0 ? clamp01((t - item.in) / enter.duration) : 1;
    if (enter.kind === 'draw') draw = e;
    else if (enter.kind === 'fade') opacity *= e;
    else pop *= easeOutBack(e);
  }
  const exit = item.exit;
  if (exit && exit.kind !== 'none' && item.out !== undefined && exit.duration > 0) {
    const x = clamp01((t - (item.out - exit.duration)) / exit.duration);
    if (exit.kind === 'fade') opacity *= 1 - x;
    else pop *= 1 - easeInCubic(x);
  }
  return { visible: opacity > 0 && pop > 0 && (draw > 0 || enter?.kind !== 'draw'), opacity, draw, pop };
}

function popMatrix(m: Mat, item: Item, k: number): Mat {
  if (k === 1) return m;
  const { anchorX: ax, anchorY: ay } = item.transform;
  return multiply(m, multiply(multiply(translate(ax, ay), scale(k, k)), translate(-ax, -ay)));
}

/** Peso de un elemento al repartir el tiempo de dibujo de un grupo (longitud aproximada). */
function strokeLength(item: Item): number {
  if (item.type !== 'stroke') return 0;
  let len = 0;
  const p = item.points;
  for (let i = POINT_STRIDE; i < p.length; i += POINT_STRIDE)
    len += Math.hypot(p[i]! - p[i - POINT_STRIDE]!, p[i + 1]! - p[i - POINT_STRIDE + 1]!);
  return len;
}

interface Leaf {
  item: Item;
  matrix: Mat;
  opacity: number;
}

function leaves(group: Extract<Item, { type: 'group' }>, m: Mat, opacity: number, tick: Ticks, out: Leaf[]): Leaf[] {
  for (const child of childrenAt(group, tick)) {
    const o = opacity * valueAt(child.opacity, tick);
    if (o <= 0) continue;
    const cm = multiply(m, matrixFrom(resolveTransform(child.transform, tick)));
    if (child.type === 'group') leaves(child, cm, o, tick, out);
    else out.push({ item: child, matrix: cm, opacity: o });
  }
  return out;
}

/**
 * Dibujo secuencial de un grupo con progreso `draw`: los contornos (trazos, textos, formas sin
 * relleno) se dibujan uno tras otro según su longitud, y después aparecen los rellenos.
 */
function pushGroupLeaves(out: RenderItem[], list: Leaf[], draw: number) {
  if (draw >= 1) {
    for (const l of list) out.push({ ...l, progress: 1, fill: 1 });
    return;
  }
  const lineDraw = clamp01(draw / OUTLINE_SHARE);
  const fillDraw = clamp01((draw - OUTLINE_SHARE) / (1 - OUTLINE_SHARE));
  const weights = list.map((l) =>
    l.item.type === 'stroke' ? Math.max(1, strokeLength(l.item)) : l.item.type === 'text' ? 40 : 0,
  );
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  list.forEach((l, i) => {
    const w = weights[i]!;
    const start = acc / total;
    acc += w;
    const end = acc / total;
    if (w === 0) {
      // Rellenos y formas: aparecen en la fase de color.
      if (fillDraw > 0) out.push({ ...l, opacity: l.opacity * fillDraw, progress: 1, fill: 1 });
      return;
    }
    const p = end > start ? clamp01((lineDraw - start) / (end - start)) : lineDraw >= start ? 1 : 0;
    if (p > 0) out.push({ ...l, progress: p, fill: 1 });
  });
}

function pushItem(out: RenderItem[], item: Item, matrix: Mat, opacity: number, draw: number, tick: Ticks) {
  if (item.type === 'group') {
    pushGroupLeaves(out, leaves(item, matrix, opacity, tick, []), draw);
    return;
  }
  if (item.type === 'shape' && draw < 1) {
    const hasLine = !!item.style.stroke && item.style.strokeWidth > 0 && item.shape !== 'polygon';
    const progress = hasLine ? clamp01(draw / OUTLINE_SHARE) : 1;
    const fill = hasLine ? clamp01((draw - OUTLINE_SHARE) / (1 - OUTLINE_SHARE)) : draw;
    out.push({ item, matrix, opacity: hasLine ? opacity : opacity * draw, progress, fill });
    return;
  }
  if (item.type === 'image' && draw < 1) {
    out.push({ item, matrix, opacity: opacity * draw, progress: 1, fill: 1 });
    return;
  }
  out.push({ item, matrix, opacity, progress: draw, fill: 1 });
}

export function evaluateScene(scene: Scene, tick: Ticks, opts: EvaluateOptions): RenderItem[] {
  const out: RenderItem[] = [];
  for (const layer of scene.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    for (const item of layerItemsAt(layer, tick)) {
      if (opts.hidden?.has(item.id)) continue;
      let a: Appearance = { visible: true, opacity: 1, draw: 1, pop: 1 };
      if (opts.mode === 'play') {
        a = appearance(item, tick);
        if (!a.visible) continue;
      }
      const opacity = valueAt(item.opacity, tick) * layer.opacity * a.opacity;
      if (opacity <= 0) continue;
      const override = opts.overrides?.get(item.id);
      const t = override ?? resolveTransform(item.transform, tick);
      let m = popMatrix(matrixFrom(t), item, a.pop);
      if (opts.mode === 'play' && item.life) m = multiply(m, lifeMatrix(item, tick, opts.beats));
      if (opts.mode === 'play' && !override) {
        const unit = opts.unit ?? 1;
        // Estela: copias tenues donde estaba hace un instante (solo si se mueve).
        if (item.trail)
          for (const g of TRAIL) {
            const past = resolveTransform(item.transform, Math.max(0, tick - g.dt));
            if (Math.hypot(past.x - t.x, past.y - t.y) / unit < 4) continue;
            pushItem(out, item, matrixFrom(past), opacity * g.alpha, a.draw, tick);
          }
        const stretch = stretchMatrix(item, tick, opts.elastic ?? 0, t.x + t.anchorX, t.y + t.anchorY, unit);
        if (stretch) m = multiply(stretch, m);
      }
      pushItem(out, item, m, opacity, a.draw, tick);
    }
  }
  return out;
}

/**
 * Matriz de la cámara de la escena: `x`, `y` son la esquina superior izquierda del encuadre en la
 * hoja y `scaleX` el zoom (1 = hoja completa). Se aplica antes de dibujar en vista previa y vídeo.
 */
export function cameraMatrix(scene: Scene, tick: Ticks): Mat {
  const c = resolveTransform(scene.camera, tick);
  const zoom = c.scaleX > 0 ? c.scaleX : 1;
  return multiply(scale(zoom, zoom), translate(-c.x, -c.y));
}

/** ¿La cámara de la escena se mueve o hace zoom en algún momento? */
export function hasCamera(scene: Scene): boolean {
  const c = scene.camera;
  return [c.x, c.y, c.scaleX].some((a) => 'keys' in a || ('value' in a && a.value !== (a === c.scaleX ? 1 : 0)));
}

// Evaluación de una escena en un instante: lista plana de lo que hay que dibujar (ver ANIMATION_ENGINE.md).
import { valueAt } from '../anim/animated';
import { matrixFrom, multiply, resolveTransform, type Mat, type StaticTransform } from '../geometry/matrix';
import type { Item, Scene } from '../model/types';
import type { Ticks } from '../time/ticks';

export interface RenderItem {
  item: Item;
  matrix: Mat;
  opacity: number;
  /** Progreso de revelado de trazos (0..1). */
  progress: number;
}

export interface EvaluateOptions {
  /** 'edit': todo visible y completo (edición). 'play': respeta entradas, salidas y revelado. */
  mode: 'edit' | 'play';
  /** Transformaciones provisionales (por ejemplo, mientras se arrastra). */
  overrides?: ReadonlyMap<string, StaticTransform>;
  /** Elementos que no se dibujan (por ejemplo, el texto que se está editando). */
  hidden?: ReadonlySet<string>;
}

export function evaluateScene(scene: Scene, tick: Ticks, opts: EvaluateOptions): RenderItem[] {
  const out: RenderItem[] = [];
  for (const layer of scene.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    for (const item of layer.items ?? []) {
      if (opts.hidden?.has(item.id)) continue;
      if (opts.mode === 'play' && (tick < item.in || (item.out !== undefined && tick >= item.out))) continue;
      let progress = 1;
      if (opts.mode === 'play' && item.type === 'stroke' && item.reveal) {
        const { start, duration } = item.reveal;
        progress = duration <= 0 ? (tick >= start ? 1 : 0) : Math.min(1, Math.max(0, (tick - start) / duration));
        if (progress <= 0) continue;
      }
      const opacity = valueAt(item.opacity, tick) * layer.opacity;
      if (opacity <= 0) continue;
      const t = opts.overrides?.get(item.id) ?? resolveTransform(item.transform, tick);
      pushItem(out, item, matrixFrom(t), opacity, progress, tick);
    }
  }
  return out;
}

/** Añade un elemento; los grupos se aplanan componiendo matriz y opacidad. */
function pushItem(out: RenderItem[], item: Item, matrix: Mat, opacity: number, progress: number, tick: Ticks) {
  if (item.type !== 'group') {
    out.push({ item, matrix, opacity, progress });
    return;
  }
  for (const child of item.children) {
    const o = opacity * valueAt(child.opacity, tick);
    if (o <= 0) continue;
    pushItem(out, child, multiply(matrix, matrixFrom(resolveTransform(child.transform, tick))), o, progress, tick);
  }
}

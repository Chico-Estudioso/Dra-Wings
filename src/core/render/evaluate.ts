// Evaluación de una escena en un instante: lista plana de lo que hay que dibujar (ver ANIMATION_ENGINE.md).
import { valueAt } from '../anim/animated';
import { matrixFrom, resolveTransform, type Mat, type StaticTransform } from '../geometry/matrix';
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
      out.push({ item, matrix: matrixFrom(t), opacity, progress });
    }
  }
  return out;
}

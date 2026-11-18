// Transiciones entre escenas: ocupan el principio de la escena que entra y, mientras duran, se ve
// el último fotograma de la anterior. Las comparten la vista previa y la exportación.
import { EASE } from '../anim/animated';
import type { Project, Scene } from '../model/types';
import type { Ticks } from '../time/ticks';

export type TransitionKind = NonNullable<Scene['transition']>['kind'];

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  cut: 'Corte',
  fade: 'Fundido',
  dip: 'Fundido a blanco',
  slide: 'Deslizar',
  zoom: 'Zoom',
  wipe: 'Barrido',
  iris: 'Círculo',
};

export interface TransitionState {
  kind: Exclude<TransitionKind, 'cut'>;
  /** Avance 0..1 (ya suavizado). */
  p: number;
  /** Escena anterior (se ve su último fotograma). */
  prev: Scene;
}

/** Transición en curso en el instante `local` de la escena, o null si no hay. */
export function transitionAt(project: Project, scene: Scene, local: Ticks): TransitionState | null {
  const tr = scene.transition;
  if (!tr || tr.kind === 'cut' || tr.duration <= 0 || local >= tr.duration) return null;
  const i = project.scenes.findIndex((s) => s.id === scene.id);
  if (i <= 0) return null;
  return { kind: tr.kind, p: EASE.easeInOut(Math.max(0, local) / tr.duration), prev: project.scenes[i - 1]! };
}

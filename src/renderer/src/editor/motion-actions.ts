// Copiar y pegar animación entre elementos (también a varios a la vez, con desfase). El portapapeles
// es de la sesión y no toca el del sistema.
import { create } from 'zustand';
import { copyMotion, hasMotion, pasteMotion, waveStarts, type CopiedMotion } from '@core/anim/copy-motion';
import { fitSceneDuration } from '@core/anim/timing';
import { keyTimes } from '@core/anim/keyframes';
import { locateItem } from '@core/edit/ops';
import { worldBounds } from '@core/geometry/items';
import type { Item } from '@core/model/types';
import { ticksFromSeconds } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { currentBeats, currentScene, editScene } from './actions';
import { useEditor } from './editor-store';
import { itemName } from './item-names';

/** Desfase entre elementos al pegar en varios. */
export type Stagger = 'none' | 'fast' | 'normal' | 'slow' | 'beat';

export const STAGGER_LABELS: Record<Stagger, string> = {
  none: 'Todos a la vez',
  fast: 'En ola rápida (0,1 s)',
  normal: 'En ola (0,25 s)',
  slow: 'En ola lenta (0,5 s)',
  beat: 'Uno en cada golpe',
};

const STAGGER_SECONDS: Record<Exclude<Stagger, 'none' | 'beat'>, number> = { fast: 0.1, normal: 0.25, slow: 0.5 };

export const useMotionClipboard = create<{ motion: CopiedMotion | null; from: string; stagger: Stagger }>(() => ({
  motion: null,
  from: '',
  stagger: 'none',
}));

/** Copia la animación del (primer) elemento seleccionado. */
export function copySelectionMotion(): void {
  const scene = currentScene();
  const id = useEditor.getState().selection[0];
  const item = scene && id ? locateItem(scene, id)?.item : null;
  if (!item) return;
  const motion = copyMotion(item);
  const from = itemName(item);
  useMotionClipboard.setState({ motion, from });
  useApp.getState().notify({
    kind: 'info',
    text: hasMotion(motion)
      ? `Animación de «${from}» copiada. Selecciona otros elementos y pulsa «Pegar animación».`
      : `«${from}» no se mueve: solo se copiará su forma de aparecer.`,
  });
}

/** Pega la animación copiada en los elementos seleccionados, cada uno desde donde está. */
export function pasteSelectionMotion(): void {
  const { motion, stagger } = useMotionClipboard.getState();
  const ids = useEditor.getState().selection;
  const scene = currentScene();
  if (!motion || !ids.length || !scene) return;
  const t = useEditor.getState().playhead;
  // De izquierda a derecha (y de arriba abajo), como se lee.
  const ordered = ids
    .map((id) => locateItem(scene, id)?.item)
    .filter((i): i is Item => !!i)
    .sort((a, b) => {
      const ba = worldBounds(a, t);
      const bb = worldBounds(b, t);
      return ba.x + ba.w / 2 - (bb.x + bb.w / 2) || ba.y - bb.y;
    });
  const starts = waveStarts(
    ordered.map((i) => i.in),
    stagger === 'none'
      ? null
      : stagger === 'beat'
        ? { beats: currentBeats(scene) }
        : { step: ticksFromSeconds(STAGGER_SECONDS[stagger]) },
  );
  editScene(ordered.length > 1 ? 'Pegar animación en varios' : 'Pegar animación', (draft) => {
    let end = 0;
    ordered.forEach((it, k) => {
      const loc = locateItem(draft, it.id);
      if (!loc) return;
      pasteMotion(loc.item, motion, starts[k]);
      end = Math.max(end, ...keyTimes(loc.item));
    });
    fitSceneDuration(draft);
    // Si la ola acaba después del final, la escena se alarga para verla entera.
    if (end > draft.duration) draft.duration = end;
  });
}

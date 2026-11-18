// Copiar y pegar animación entre elementos (también a varios a la vez). El portapapeles es de la
// sesión y no toca el del sistema.
import { create } from 'zustand';
import { copyMotion, hasMotion, pasteMotion, type CopiedMotion } from '@core/anim/copy-motion';
import { fitSceneDuration } from '@core/anim/timing';
import { locateItem } from '@core/edit/ops';
import { useApp } from '../state/app-store';
import { currentScene, editScene } from './actions';
import { useEditor } from './editor-store';
import { itemName } from './item-names';

export const useMotionClipboard = create<{ motion: CopiedMotion | null; from: string }>(() => ({
  motion: null,
  from: '',
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

/** Pega la animación copiada en todos los elementos seleccionados, cada uno desde donde está. */
export function pasteSelectionMotion(): void {
  const { motion } = useMotionClipboard.getState();
  const ids = useEditor.getState().selection;
  if (!motion || !ids.length) return;
  editScene(ids.length > 1 ? 'Pegar animación en varios' : 'Pegar animación', (scene) => {
    for (const id of ids) {
      const loc = locateItem(scene, id);
      if (loc) pasteMotion(loc.item, motion);
    }
    fitSceneDuration(scene);
  });
}

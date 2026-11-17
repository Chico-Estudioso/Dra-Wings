// Reproducción: recorre las escenas en orden desde el cabezal. En M5 el reloj será el del audio.
import { useEffect } from 'react';
import { locateTime, projectDuration, sceneStart } from '@core/edit/scenes';
import { TICKS_PER_SECOND } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { useEditor } from './editor-store';

export function togglePlay(): void {
  const ed = useEditor.getState();
  ed.setPlaying(!ed.playing);
}

export function usePlayback(): void {
  const playing = useEditor((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    const project0 = useApp.getState().doc?.project;
    const ed0 = useEditor.getState();
    if (!project0 || !ed0.sceneId) return;
    const total0 = projectDuration(project0);
    let origin = sceneStart(project0, ed0.sceneId) + ed0.playhead;
    if (origin >= total0 - 1) origin = 0; // al final: vuelve a empezar
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const project = useApp.getState().doc?.project;
      const ed = useEditor.getState();
      if (!project || !ed.playing) return;
      const g = origin + ((performance.now() - t0) / 1000) * TICKS_PER_SECOND;
      const total = projectDuration(project);
      const { scene, local } = locateTime(project, Math.min(g, total));
      if (scene.id !== ed.sceneId) ed.setScene(scene.id, scene.layers[scene.layers.length - 1]!.id);
      ed.setPlayhead(local);
      if (g >= total) {
        ed.setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

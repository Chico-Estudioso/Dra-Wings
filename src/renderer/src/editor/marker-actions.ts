// Escenas a las marcas: ajustar las escenas a los cortes marcados (también al terminar de marcar
// mientras sonaba la música) y borrar todas las marcas.
import { useEffect } from 'react';
import { fitScenesToMarkers, markerCuts, type MarkerSyncResult } from '@core/edit/marker-sync';
import { useApp } from '../state/app-store';
import { useEditor } from './editor-store';

const app = () => useApp.getState();

/** Marcas puestas durante la reproducción en curso. */
let liveMarks = 0;

export function noteLiveMarker(): void {
  liveMarks++;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Cada marca es un corte: la escena 1 termina en la primera, la 2 en la segunda… */
export function syncScenesToMarkers(): void {
  const p = app().doc?.project;
  if (!p) return;
  if (!markerCuts(p).length) {
    app().notify({ kind: 'info', text: 'Pon marcas (M) donde quieras que empiece cada escena.' });
    return;
  }
  let r: MarkerSyncResult = { scenes: 0, sped: 0, unused: 0 };
  app().apply('Ajustar las escenas a las marcas', (draft) => {
    r = fitScenesToMarkers(draft);
  });
  // El cabezal se queda dentro de la escena actual aunque haya encogido.
  const ed = useEditor.getState();
  const scene = app().doc?.project.scenes.find((s) => s.id === ed.sceneId);
  if (scene && ed.playhead > scene.duration) ed.setPlayhead(scene.duration);
  const parts = [
    r.scenes
      ? `${plural(r.scenes, 'escena ajustada', 'escenas ajustadas')} a las marcas.`
      : 'Las escenas ya estaban en sus marcas.',
  ];
  if (r.sped) parts.push(`${plural(r.sped, 'elemento aparece', 'elementos aparecen')} más deprisa para que quepa.`);
  if (r.unused)
    parts.push(
      `${plural(r.unused, 'marca sobra', 'marcas sobran')}: hay más cortes que escenas (añade escenas y vuelve a ajustar).`,
    );
  app().notify({ kind: 'info', text: parts.join(' ') });
}

export function clearMarkers(): void {
  app().apply('Borrar todas las marcas', (draft) => {
    draft.markers = [];
  });
  useEditor.getState().selectMarker(null);
}

/** Al parar la reproducción tras marcar, ofrece ajustar las escenas a las marcas. */
export function useLiveMarkerNotice(): void {
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        if (!prev.playing || s.playing || liveMarks === 0) return;
        const n = liveMarks;
        liveMarks = 0;
        const p = app().doc?.project;
        if (!p || p.scenes.length < 2) return;
        app().notify({
          kind: 'info',
          text: `Has puesto ${plural(n, 'marca', 'marcas')} mientras sonaba. En cada marca puede empezar la escena siguiente.`,
          action: { label: 'Ajustar las escenas a las marcas', run: syncScenesToMarkers },
        });
      }),
    [],
  );
}

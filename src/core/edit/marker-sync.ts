// Escenas a las marcas: cada marca es un corte. Desde el principio del vídeo, la escena 1 termina en
// la primera marca, la 2 en la segunda, y así. Pensado para videoclips: se marca con M mientras suena
// la canción (en cada cambio de frase) y las escenas de la letra caen justo en su sitio.
import type { Item, Project, Scene } from '../model/types';
import { snapToFrame, TICKS_PER_SECOND, ticksPerFrame, type Ticks } from '../time/ticks';

/** Dos pulsaciones más juntas que esto cuentan como una (doble toque sin querer). */
export const MIN_SCENE = Math.round(TICKS_PER_SECOND / 5);
/** Rato que queda al final de la escena para ver lo que se ha dibujado o leer el texto. */
const HOLD = TICKS_PER_SECOND / 2;

/** Cortes (instantes globales, en fotogramas exactos) a partir de las marcas, sin repetidos ni dobles toques. */
export function markerCuts(project: Project): Ticks[] {
  const fps = project.settings.fps;
  const gap = Math.max(MIN_SCENE, ticksPerFrame(fps));
  const cuts: Ticks[] = [];
  for (const t of project.markers.map((m) => snapToFrame(m.t, fps)).sort((a, b) => a - b))
    if (t - (cuts[cuts.length - 1] ?? 0) >= gap) cuts.push(t);
  return cuts;
}

/**
 * Acelera las entradas que no terminarían antes del final de la escena (dejando un rato para verlas),
 * sin alargar ninguna. Devuelve cuántos elementos se han acelerado.
 */
export function fitEntrancesTo(scene: Scene, duration: Ticks, frame: Ticks): number {
  const until = duration - Math.min(HOLD, duration / 4);
  let changed = 0;
  const fit = (it: Item) => {
    const e = it.enter;
    if (!e || e.kind === 'none' || it.in >= until || it.in + e.duration <= until) return;
    e.duration = Math.max(frame, Math.round(until - it.in));
    changed++;
  };
  for (const layer of scene.layers) {
    layer.items?.forEach(fit);
    layer.cels?.forEach((c) => c.items.forEach(fit));
  }
  return changed;
}

export interface MarkerSyncResult {
  /** Escenas cuya duración ha cambiado. */
  scenes: number;
  /** Elementos cuya entrada se ha acelerado para que quepa. */
  sped: number;
  /** Marcas que sobran (hay más cortes que escenas). */
  unused: number;
}

/**
 * Ajusta la duración de las escenas para que cada una termine en un corte. Las marcas se alinean al
 * fotograma para quedar justo en el borde entre escenas.
 */
export function fitScenesToMarkers(project: Project): MarkerSyncResult {
  const fps = project.settings.fps;
  const frame = ticksPerFrame(fps);
  const cuts = markerCuts(project);
  const seen = new Set<Ticks>();
  project.markers = project.markers.filter((m) => {
    m.t = snapToFrame(m.t, fps);
    if (seen.has(m.t)) return false; // dos marcas en el mismo fotograma: queda una
    seen.add(m.t);
    return true;
  });
  const n = Math.min(cuts.length, project.scenes.length);
  let start = 0;
  let scenes = 0;
  let sped = 0;
  for (let i = 0; i < n; i++) {
    const scene = project.scenes[i]!;
    const duration = cuts[i]! - start;
    start = cuts[i]!;
    if (duration === scene.duration) continue;
    scene.duration = duration;
    scenes++;
    sped += fitEntrancesTo(scene, duration, frame);
    if (scene.transition && scene.transition.duration > duration / 2)
      scene.transition.duration = Math.max(frame, Math.round(duration / 2));
  }
  return { scenes, sped, unused: cuts.length - n };
}

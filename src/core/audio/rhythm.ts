// Golpes de la música en el tiempo del proyecto y de cada escena. Los golpes se guardan en el medio
// de audio (instantes dentro del archivo), así que siguen a la canción aunque se mueva o recorte su
// clip. Solo cuentan las pistas de música que suenan.
import { sceneStart } from '../edit/scenes';
import type { Project } from '../model/types';
import type { Ticks } from '../time/ticks';

export interface Beat {
  /** Instante global (proyecto). */
  t: Ticks;
  /** Empieza compás. */
  bar: boolean;
}

// Por pistas; también depende de los medios (ahí se guardan los golpes).
const cache = new WeakMap<object, { assets: Project['assets']; beats: Beat[] }>();

/** Golpes de las pistas de música que suenan, ordenados (instantes globales). */
export function projectBeats(project: Project): Beat[] {
  const key = project.audioTracks;
  const hit = cache.get(key);
  if (hit && hit.assets === project.assets) return hit.beats;
  const assets = new Map(project.assets.map((a) => [a.id, a]));
  const out: Beat[] = [];
  for (const track of project.audioTracks) {
    if (track.kind !== 'music' || track.muted) continue;
    for (const clip of track.clips) {
      const beats = assets.get(clip.assetId)?.beats;
      if (!beats) continue;
      beats.ticks.forEach((t, i) => {
        if (t < clip.sourceOffset || t >= clip.sourceOffset + clip.duration) return;
        out.push({ t: clip.start + t - clip.sourceOffset, bar: (i - beats.downbeat) % 4 === 0 });
      });
    }
  }
  out.sort((a, b) => a.t - b.t);
  cache.set(key, { assets: project.assets, beats: out });
  return out;
}

/** Golpes dentro de una escena, en su tiempo local. */
export function sceneBeats(project: Project, sceneId: string, duration: Ticks): Beat[] {
  const start = sceneStart(project, sceneId);
  return projectBeats(project)
    .filter((b) => b.t >= start && b.t < start + duration)
    .map((b) => ({ ...b, t: b.t - start }));
}

/** ¿Hay alguna música con el ritmo detectado? */
export const hasBeats = (project: Project) => projectBeats(project).length > 0;

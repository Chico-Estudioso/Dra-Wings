// Cálculos de audio puros: ventanas de reproducción de clips, fundidos y medios usados.
import type { AudioClip, AudioTrack, Item, Project } from '../model/types';
import type { Ticks } from '../time/ticks';

export const clipEnd = (c: AudioClip): Ticks => c.start + c.duration;

/** Ganancia de un clip (sin la de la pista) a `t` ticks desde el inicio del clip, con fundidos lineales. */
export function clipGainAt(c: AudioClip, t: Ticks): number {
  if (t < 0 || t > c.duration) return 0;
  let g = c.gain;
  if (c.fadeIn > 0 && t < c.fadeIn) g *= t / c.fadeIn;
  const fromEnd = c.duration - t;
  if (c.fadeOut > 0 && fromEnd < c.fadeOut) g *= fromEnd / c.fadeOut;
  return g;
}

export interface ScheduledClip {
  track: AudioTrack;
  clip: AudioClip;
  /** Cuánto esperar desde `from` hasta que empiece a sonar. */
  delay: Ticks;
  /** Posición en el archivo de origen donde empieza a sonar. */
  sourceStart: Ticks;
  /** Cuánto suena. */
  length: Ticks;
  /** Posición dentro del clip en la que empieza (para los fundidos). */
  clipOffset: Ticks;
}

/** Clips que suenan a partir del instante global `from` (opcionalmente hasta `to`). */
export function scheduleFrom(project: Project, from: Ticks, to = Infinity): ScheduledClip[] {
  const out: ScheduledClip[] = [];
  for (const track of project.audioTracks) {
    if (track.muted || track.volume <= 0) continue;
    for (const clip of track.clips) {
      const end = Math.min(clipEnd(clip), to);
      if (end <= from || clip.start >= to) continue;
      const clipOffset = Math.max(0, from - clip.start);
      out.push({
        track,
        clip,
        delay: Math.max(0, clip.start - from),
        sourceStart: clip.sourceOffset + clipOffset,
        length: end - (clip.start + clipOffset),
        clipOffset,
      });
    }
  }
  return out;
}

export function audioEnd(project: Project): Ticks {
  return Math.max(0, ...project.audioTracks.flatMap((t) => t.clips.map(clipEnd)));
}

function collectImageAssets(items: Item[], into: Set<string>) {
  for (const it of items) {
    if (it.type === 'image') into.add(it.assetId);
    if (it.type === 'group') collectImageAssets(it.children, into);
  }
}

/** Ids de medios usados por el proyecto (imágenes y clips de audio). */
export function usedAssetIds(project: Project): Set<string> {
  const used = new Set<string>();
  for (const s of project.scenes)
    for (const l of s.layers) {
      collectImageAssets(l.items ?? [], used);
      for (const c of l.cels ?? []) collectImageAssets(c.items, used);
    }
  for (const t of project.audioTracks) for (const c of t.clips) used.add(c.assetId);
  return used;
}

/** Copia del proyecto sin los medios que ya no se usan (se aplica al guardar). */
export function pruneAssets(project: Project): Project {
  const used = usedAssetIds(project);
  if (project.assets.every((a) => used.has(a.id))) return project;
  return { ...project, assets: project.assets.filter((a) => used.has(a.id)) };
}

/** El proyecto tal como debe sonar sin las pistas de narración (para grabar una nueva encima). */
export function withoutNarration(project: Project): Project {
  return project.audioTracks.some((t) => t.kind === 'narration')
    ? { ...project, audioTracks: project.audioTracks.filter((t) => t.kind !== 'narration') }
    : project;
}

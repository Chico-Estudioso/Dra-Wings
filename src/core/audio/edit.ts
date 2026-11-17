// Operaciones de edición sobre medios, pistas de audio y marcadores (se aplican sobre borradores de Immer).
import { newId } from '../model/factory';
import type { Asset, AudioClip, AudioTrack, Marker, Project } from '../model/types';
import type { Ticks } from '../time/ticks';
import { clipEnd } from './clips';

export type TrackKind = AudioTrack['kind'];

export const TRACK_NAMES: Record<TrackKind, string> = {
  narration: 'Narración',
  music: 'Música',
  sfx: 'Efectos',
};
const TRACK_ORDER: TrackKind[] = ['narration', 'music', 'sfx'];

/** Duración mínima de un clip al recortarlo. */
export const MIN_CLIP: Ticks = 70_560_000; // 0,1 s

/** Registra un medio en el proyecto; si ya existe el mismo contenido, reutiliza su entrada. */
export function upsertAsset(project: Project, media: Omit<Asset, 'id'>): Asset {
  const existing = project.assets.find((a) => a.hash === media.hash && a.mime === media.mime);
  if (existing) {
    if (media.durationTicks !== undefined && existing.durationTicks === undefined)
      existing.durationTicks = media.durationTicks;
    return existing;
  }
  const asset: Asset = { id: newId(), ...media };
  project.assets.push(asset);
  return asset;
}

/** Primera pista del tipo dado; si no hay, la crea en su posición habitual. */
export function trackFor(project: Project, kind: TrackKind): AudioTrack {
  const found = project.audioTracks.find((t) => t.kind === kind);
  if (found) return found;
  const track: AudioTrack = { id: newId(), name: TRACK_NAMES[kind], kind, volume: 1, muted: false, clips: [] };
  const rank = TRACK_ORDER.indexOf(kind);
  const at = project.audioTracks.findIndex((t) => TRACK_ORDER.indexOf(t.kind) > rank);
  project.audioTracks.splice(at < 0 ? project.audioTracks.length : at, 0, track);
  return project.audioTracks.find((t) => t.id === track.id)!;
}

const sortClips = (track: AudioTrack) => track.clips.sort((a, b) => a.start - b.start);

/**
 * Añade un clip a la pista empezando en `start` o, si ese hueco está ocupado, justo después de los
 * clips con los que chocaría (la narración se va encadenando sin solaparse).
 */
export function addClip(track: AudioTrack, assetId: string, start: Ticks, duration: Ticks): AudioClip {
  let at = Math.max(0, Math.round(start));
  for (let moved = true; moved;) {
    moved = false;
    for (const c of track.clips)
      if (at < clipEnd(c) && at + duration > c.start) {
        at = clipEnd(c);
        moved = true;
      }
  }
  const clip: AudioClip = {
    id: newId(),
    assetId,
    start: at,
    sourceOffset: 0,
    duration,
    gain: 1,
    fadeIn: 0,
    fadeOut: 0,
  };
  track.clips.push(clip);
  sortClips(track);
  return clip;
}

export function findClip(project: Project, clipId: string): { track: AudioTrack; clip: AudioClip } | null {
  for (const track of project.audioTracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

function clampFades(clip: AudioClip) {
  clip.fadeIn = Math.max(0, Math.min(clip.fadeIn, clip.duration));
  clip.fadeOut = Math.max(0, Math.min(clip.fadeOut, clip.duration - clip.fadeIn));
}

export function moveClip(project: Project, clipId: string, start: Ticks): void {
  const f = findClip(project, clipId);
  if (!f) return;
  f.clip.start = Math.max(0, Math.round(start));
  sortClips(f.track);
}

/** Resultado de recortar el principio o el final de un clip `dt` ticks sin salirse del audio de origen. */
export function trimmed(
  c: Pick<AudioClip, 'start' | 'sourceOffset' | 'duration'>,
  edge: 'start' | 'end',
  dt: Ticks,
  sourceDuration = Infinity,
): { start: Ticks; sourceOffset: Ticks; duration: Ticks } {
  if (edge === 'start') {
    const d = Math.round(Math.max(-c.sourceOffset, -c.start, Math.min(dt, c.duration - MIN_CLIP)));
    return { start: c.start + d, sourceOffset: c.sourceOffset + d, duration: c.duration - d };
  }
  const max = sourceDuration - c.sourceOffset;
  return { ...c, duration: Math.round(Math.max(MIN_CLIP, Math.min(c.duration + dt, max))) };
}

export const sourceDurationOf = (project: Project, clip: AudioClip): Ticks =>
  project.assets.find((a) => a.id === clip.assetId)?.durationTicks ?? Infinity;

export function trimClip(project: Project, clipId: string, edge: 'start' | 'end', dt: Ticks): void {
  const f = findClip(project, clipId);
  if (!f) return;
  Object.assign(f.clip, trimmed(f.clip, edge, dt, sourceDurationOf(project, f.clip)));
  clampFades(f.clip);
  sortClips(f.track);
}

export function setClipFades(project: Project, clipId: string, fades: { fadeIn?: Ticks; fadeOut?: Ticks }): void {
  const f = findClip(project, clipId);
  if (!f) return;
  if (fades.fadeIn !== undefined) f.clip.fadeIn = Math.round(fades.fadeIn);
  if (fades.fadeOut !== undefined) f.clip.fadeOut = Math.round(fades.fadeOut);
  clampFades(f.clip);
}

/** Divide un clip en el instante global `at`. Devuelve el id de la segunda parte. */
export function splitClip(project: Project, clipId: string, at: Ticks): string | null {
  const f = findClip(project, clipId);
  if (!f) return null;
  const c = f.clip;
  const cut = Math.round(at - c.start);
  if (cut < MIN_CLIP || c.duration - cut < MIN_CLIP) return null;
  const second: AudioClip = {
    ...c,
    id: newId(),
    start: c.start + cut,
    sourceOffset: c.sourceOffset + cut,
    duration: c.duration - cut,
    fadeIn: 0,
  };
  c.duration = cut;
  c.fadeOut = 0;
  clampFades(c);
  clampFades(second);
  f.track.clips.push(second);
  sortClips(f.track);
  return second.id;
}

/** Quita un clip; las pistas que se quedan vacías desaparecen. */
export function removeClip(project: Project, clipId: string): void {
  for (const t of project.audioTracks) t.clips = t.clips.filter((c) => c.id !== clipId);
  project.audioTracks = project.audioTracks.filter((t) => t.clips.length > 0);
}

// Marcadores (tiempo global del proyecto).

const sortMarkers = (project: Project) => project.markers.sort((a, b) => a.t - b.t);

export function addMarker(project: Project, t: Ticks, label?: string): Marker {
  const at = Math.max(0, Math.round(t));
  const existing = project.markers.find((m) => m.t === at);
  if (existing) return existing;
  const marker: Marker = { id: newId(), t: at, label: label ?? `Marca ${project.markers.length + 1}` };
  project.markers.push(marker);
  sortMarkers(project);
  return marker;
}

export function renameMarker(project: Project, id: string, label: string): void {
  const m = project.markers.find((x) => x.id === id);
  if (m) m.label = label.trim().slice(0, 200);
}

export function moveMarker(project: Project, id: string, t: Ticks): void {
  const m = project.markers.find((x) => x.id === id);
  if (!m) return;
  m.t = Math.max(0, Math.round(t));
  sortMarkers(project);
}

export function removeMarker(project: Project, id: string): void {
  project.markers = project.markers.filter((m) => m.id !== id);
}

/** Ajuste magnético: si `t` está a menos de `tolerance` de algún objetivo, devuelve ese objetivo. */
export function snapTo(t: Ticks, targets: readonly Ticks[], tolerance: Ticks): Ticks {
  let best = t;
  let dist = tolerance;
  for (const x of targets) {
    const d = Math.abs(x - t);
    if (d <= dist) {
      best = x;
      dist = d;
    }
  }
  return best;
}

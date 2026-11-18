// Acciones de medios: importar imágenes y audio, editar clips y marcas. Todas pasan por el historial.
import {
  addClip,
  addMarker,
  findClip,
  moveClip,
  moveMarker,
  removeClip,
  removeMarker,
  renameMarker,
  setClipFades,
  splitClip,
  TRACK_NAMES,
  trackFor,
  trimClip,
  upsertAsset,
  type TrackKind,
} from '@core/audio/edit';
import { clipEnd } from '@core/audio/clips';
import { projectDuration, sceneStart } from '@core/edit/scenes';
import { createImage } from '@core/model/factory';
import type { AudioTrack, Project } from '@core/model/types';
import { ticksFromSeconds, ticksPerFrame, type Ticks } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { insertItems, writableActiveLayer } from './actions';
import { analyzeVoice, detectRhythm } from './rhythm-actions';
import { useEditor } from './editor-store';
import { audioContext, loadAudio, loadImage } from './media';
import { SFX_LABELS, SFX_RATE, synthSfx, type SfxId } from '@core/audio/sfx';
import { encodeWav } from '@core/audio/wav';
import { livePlayhead } from './playback';
import { noteLiveMarker } from './marker-actions';

/** Parte de la hoja que ocupa como máximo una imagen recién importada. */
const IMAGE_FIT = 0.6;

const app = () => useApp.getState();
const project = () => app().doc?.project ?? null;
const fail = (text: string) => app().notify({ kind: 'error', text });

/** Instante global del cabezal (el cabezal del editor es relativo a la escena actual). */
export function globalPlayhead(): Ticks {
  const p = project();
  const { sceneId, playhead } = useEditor.getState();
  return p && sceneId ? sceneStart(p, sceneId) + playhead : 0;
}

type StoredMedia = { hash: string; mime: string; name: string; size: number };

/** Coloca una imagen ya guardada en la caché en la capa activa, centrada en `at` (por defecto, la hoja). */
export async function addImage(r: StoredMedia, at?: { x: number; y: number }): Promise<boolean> {
  if (!writableActiveLayer()) return false;
  let bitmap: ImageBitmap;
  try {
    bitmap = await loadImage(r);
  } catch {
    fail('No se pudo leer la imagen. Puede que el archivo esté dañado.');
    return false;
  }
  const p = project();
  if (!p) return false;
  const { width: W, height: H } = p.settings;
  const k = Math.min(1, (W * IMAGE_FIT) / bitmap.width, (H * IMAGE_FIT) / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  const name = r.name.replace(/\.[^.]+$/, '') || 'Imagen';
  const item = createImage('', (at?.x ?? W / 2) - w / 2, (at?.y ?? H / 2) - h / 2, w, h, name);
  return insertItems([item], 'Importar imagen', (draft) => {
    item.assetId = upsertAsset(draft, { hash: r.hash, mime: r.mime, name: r.name, size: r.size }).id;
  });
}

/** Importa una imagen con el diálogo nativo. */
export async function importImage(at?: { x: number; y: number }): Promise<void> {
  if (!writableActiveLayer()) return;
  const r = await window.dw.importMedia('image');
  if (r.status === 'canceled') return;
  if (r.status === 'error') return fail(r.message);
  await addImage(r, at);
}

const ceilToFrame = (t: Ticks, p: Project) =>
  Math.ceil(t / ticksPerFrame(p.settings.fps)) * ticksPerFrame(p.settings.fps);

/**
 * Coloca un audio ya guardado en la caché en la pista del tipo indicado, en el instante global `at`
 * (por defecto, el cabezal). La narración alarga la última escena si hace falta para que se oiga
 * entera; la música y los efectos se cortan al final del vídeo.
 */
export async function addAudio(
  kind: TrackKind,
  r: StoredMedia,
  label = `Importar ${TRACK_NAMES[kind].toLowerCase()}`,
  at = globalPlayhead(),
): Promise<boolean> {
  let duration: Ticks;
  try {
    duration = ticksFromSeconds((await loadAudio(r)).duration);
  } catch {
    fail('No se pudo leer el audio. Prueba con un archivo MP3, WAV u OGG.');
    return false;
  }
  if (duration <= 0) {
    fail('El audio está vacío.');
    return false;
  }
  let clipId: string | null = null;
  let extended: string | null = null;
  let assetId = '';
  let needsRhythm = false;
  let needsVoice = false;
  app().apply(label, (draft) => {
    const asset = upsertAsset(draft, { ...r, durationTicks: duration });
    assetId = asset.id;
    needsRhythm = kind === 'music' && !asset.beats;
    needsVoice = kind === 'narration' && !asset.voice;
    const clip = addClip(trackFor(draft, kind), asset.id, at, duration);
    clipId = clip.id;
    const missing = clipEnd(clip) - projectDuration(draft);
    if (kind === 'narration' && missing > 0) {
      const last = draft.scenes[draft.scenes.length - 1]!;
      last.duration = ceilToFrame(last.duration + missing, draft);
      extended = last.name;
    }
  });
  if (clipId) useEditor.getState().selectClip(clipId);
  // La música se analiza sola para poder animar y cortar al ritmo.
  if (needsRhythm) void detectRhythm(assetId, { quiet: true });
  // La narración se analiza para que los personajes que hablan muevan la boca.
  if (needsVoice) void analyzeVoice(assetId, { quiet: true });
  if (extended)
    app().notify({ kind: 'info', text: `La escena «${extended}» se ha alargado para que se oiga toda la narración.` });
  return true;
}

/** Importa un audio con el diálogo nativo en la pista del tipo indicado, en el cabezal. */
export async function importAudio(kind: TrackKind): Promise<void> {
  const r = await window.dw.importMedia('audio');
  if (r.status === 'canceled') return;
  if (r.status === 'error') return fail(r.message);
  await addAudio(kind, r);
}

function editAudio(label: string, fn: (p: Project) => void) {
  app().apply(label, fn);
}

export function moveClipTo(clipId: string, start: Ticks): void {
  editAudio('Mover audio', (p) => moveClip(p, clipId, start));
}

export function trimClipBy(clipId: string, edge: 'start' | 'end', dt: Ticks): void {
  editAudio('Recortar audio', (p) => trimClip(p, clipId, edge, dt));
}

export function setClipGain(clipId: string, gain: number): void {
  editAudio('Volumen del clip', (p) => {
    const f = findClip(p, clipId);
    if (f) f.clip.gain = Math.max(0, Math.min(4, gain));
  });
}

export function setFades(clipId: string, fades: { fadeIn?: Ticks; fadeOut?: Ticks }): void {
  editAudio('Fundido', (p) => setClipFades(p, clipId, fades));
}

export function splitClipAtPlayhead(clipId: string): void {
  const at = globalPlayhead();
  let created: string | null = null;
  editAudio('Dividir audio', (p) => {
    created = splitClip(p, clipId, at);
  });
  if (created) useEditor.getState().selectClip(created);
  else app().notify({ kind: 'info', text: 'Coloca el cabezal dentro del clip para dividirlo.' });
}

export function deleteClip(clipId: string): void {
  editAudio('Eliminar audio', (p) => removeClip(p, clipId));
  useEditor.getState().selectClip(null);
}

export function updateTrack(trackId: string, label: string, fn: (t: AudioTrack) => void): void {
  editAudio(label, (p) => {
    const t = p.audioTracks.find((x) => x.id === trackId);
    if (t) fn(t);
  });
}

// Marcas

/** Marca en el cabezal o, mientras suena, en el instante que se está oyendo. */
export function addMarkerAtPlayhead(): void {
  const p = project();
  const live = livePlayhead();
  const at = live !== null && p ? Math.min(live, projectDuration(p)) : globalPlayhead();
  let id: string | null = null;
  editAudio('Añadir marca', (draft) => {
    id = addMarker(draft, at).id;
  });
  if (!id) return;
  if (live !== null) noteLiveMarker();
  else useEditor.getState().selectMarker(id);
}

export function renameMarkerTo(id: string, label: string): void {
  editAudio('Renombrar marca', (p) => renameMarker(p, id, label));
}

export function moveMarkerTo(id: string, t: Ticks): void {
  editAudio('Mover marca', (p) => moveMarker(p, id, t));
}

export function deleteMarker(id: string): void {
  editAudio('Eliminar marca', (p) => removeMarker(p, id));
  useEditor.getState().selectMarker(null);
}

/** Inserta un efecto de sonido sintetizado en el cabezal (pista de efectos) y lo hace sonar. */
export async function insertSfx(id: SfxId): Promise<void> {
  const samples = synthSfx(id);
  const label = SFX_LABELS[id];
  try {
    const ctx = audioContext();
    const buf = ctx.createBuffer(1, samples.length, SFX_RATE);
    buf.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    void ctx.resume().then(() => src.start());
  } catch {
    // Sin audio disponible: se inserta igualmente.
  }
  const stored = await window.dw.importMediaBytes('audio', `${label}.wav`, encodeWav(samples, SFX_RATE));
  if (stored.status !== 'ok') return fail(stored.status === 'error' ? stored.message : 'No se pudo guardar el efecto.');
  await addAudio('sfx', stored, `Efecto: ${label.toLowerCase()}`);
}

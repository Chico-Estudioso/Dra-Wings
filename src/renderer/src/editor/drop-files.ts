// Archivos soltados en la ventana desde el explorador: imágenes al lienzo y audio a la línea de tiempo.
// El renderer lee el contenido del archivo (lo eligió el usuario al arrastrarlo) y se lo pasa al
// proceso principal como bytes: nunca se envía una ruta.
import type { TrackKind } from '@core/audio/edit';
import type { Ticks } from '@core/time/ticks';
import { MEDIA_MAX_BYTES } from '@shared/media';
import { create } from 'zustand';
import { useApp } from '../state/app-store';
import { addAudio, addImage } from './media-actions';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|opus|m4a|aac|flac)$/i;

export function mediaKindOf(file: { name: string; type: string }): 'image' | 'audio' | null {
  if (file.type.startsWith('image/') || IMAGE_EXT.test(file.name)) return 'image';
  if (file.type.startsWith('audio/') || AUDIO_EXT.test(file.name)) return 'audio';
  return null;
}

/** ¿El arrastre trae archivos del sistema? */
export const hasFiles = (dt: DataTransfer | null) => !!dt && [...dt.types].includes('Files');

/** Audio soltado sin pista concreta: se pregunta a qué pista va. */
export const usePendingAudio = create<{ files: File[]; at: Ticks | null }>(() => ({ files: [], at: null }));

const fail = (text: string) => useApp.getState().notify({ kind: 'error', text });

async function store(file: File, kind: 'image' | 'audio') {
  if (file.size > MEDIA_MAX_BYTES[kind]) {
    fail(`«${file.name}» es demasiado grande.`);
    return null;
  }
  const r = await window.dw.importMediaBytes(kind, file.name, new Uint8Array(await file.arrayBuffer()));
  if (r.status !== 'ok') {
    fail(r.status === 'error' ? `«${file.name}»: ${r.message}` : `No se pudo importar «${file.name}».`);
    return null;
  }
  return r;
}

export interface DropTarget {
  /** Punto de la hoja donde se soltó (imágenes). */
  point?: { x: number; y: number };
  /** Instante global donde se soltó (audio). Por defecto, el cabezal. */
  at?: Ticks;
  /** Pista sobre la que se soltó el audio; si no hay, se pregunta. */
  track?: TrackKind;
}

/** Importa los archivos soltados, uno tras otro, en el orden en que llegan. */
export async function importDroppedFiles(files: File[], target: DropTarget): Promise<void> {
  const audio: File[] = [];
  const ignored: string[] = [];
  let offset = 0;
  for (const file of files) {
    const kind = mediaKindOf(file);
    if (kind === 'image') {
      const r = await store(file, 'image');
      // Varias imágenes a la vez: se escalonan un poco para que no queden exactamente encima.
      const p = target.point && { x: target.point.x + offset, y: target.point.y + offset };
      if (r && (await addImage(r, p))) offset += 40;
    } else if (kind === 'audio') audio.push(file);
    else ignored.push(file.name);
  }
  if (ignored.length)
    fail(
      `No se puede usar ${ignored.length === 1 ? `«${ignored[0]}»` : `${ignored.length} archivos`}: solo imágenes y audio.`,
    );
  if (!audio.length) return;
  if (target.track) await addAudioFiles(audio, target.track, target.at);
  else usePendingAudio.setState({ files: audio, at: target.at ?? null });
}

/** Coloca audios seguidos en la pista indicada (cada uno se encadena tras el anterior). */
export async function addAudioFiles(files: File[], kind: TrackKind, at?: Ticks): Promise<void> {
  for (const file of files) {
    const r = await store(file, 'audio');
    if (r) await addAudio(kind, r, undefined, at);
  }
}

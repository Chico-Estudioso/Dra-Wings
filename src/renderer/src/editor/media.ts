// Medios en el renderer: imágenes y audio decodificados, en caché por hash de contenido.
// Se cargan bajo demanda desde el protocolo propio (`app://dra-wings/media/…`); al terminar una
// carga se incrementa `useMediaVersion` para que el lienzo y la línea de tiempo se redibujen.
import { create } from 'zustand';
import { computePeaks, type AudioBuffers } from '@core/audio/mix';
import type { ImageSources } from '@core/render/draw';
import type { Asset, Project } from '@core/model/types';
import { mediaUrl } from '@shared/media';

/** Frecuencia de muestreo con la que se decodifica todo el audio (la misma que usará la exportación). */
export const AUDIO_SAMPLE_RATE = 48_000;

export const useMediaVersion = create<{ v: number }>(() => ({ v: 0 }));
const bump = () => useMediaVersion.setState((s) => ({ v: s.v + 1 }));

type Slot<T> = { state: 'loading'; promise: Promise<T> } | { state: 'ready'; value: T } | { state: 'error' };

const images = new Map<string, Slot<ImageBitmap>>();
const audio = new Map<string, Slot<AudioBuffer>>();
const peaks = new Map<string, Float32Array>();

async function fetchMedia(asset: Pick<Asset, 'hash' | 'mime'>): Promise<ArrayBuffer> {
  const url = mediaUrl(asset.hash, asset.mime);
  if (!url) throw new Error('Medio no válido');
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Medio no disponible (${r.status})`);
  return r.arrayBuffer();
}

function load<T>(cache: Map<string, Slot<T>>, key: string, run: () => Promise<T>): Promise<T> {
  const slot = cache.get(key);
  if (slot?.state === 'ready') return Promise.resolve(slot.value);
  if (slot?.state === 'loading') return slot.promise;
  const promise = run().then(
    (value) => {
      cache.set(key, { state: 'ready', value });
      bump();
      return value;
    },
    (e: unknown) => {
      cache.set(key, { state: 'error' });
      bump();
      throw e;
    },
  );
  cache.set(key, { state: 'loading', promise });
  return promise;
}

export function loadImage(asset: Pick<Asset, 'hash' | 'mime'>): Promise<ImageBitmap> {
  return load(images, asset.hash, async () => {
    const bytes = await fetchMedia(asset);
    return createImageBitmap(new Blob([bytes], { type: asset.mime }));
  });
}

/** Decodifica con un contexto sin salida: no depende del dispositivo de audio y siempre da 48 kHz. */
export function loadAudio(asset: Pick<Asset, 'hash' | 'mime'>): Promise<AudioBuffer> {
  return load(audio, asset.hash, async () => {
    const bytes = await fetchMedia(asset);
    return new OfflineAudioContext(1, 1, AUDIO_SAMPLE_RATE).decodeAudioData(bytes);
  });
}

function collect<T>(
  project: Project,
  cache: Map<string, Slot<T>>,
  wanted: (a: Asset) => boolean,
  start: (a: Asset) => Promise<T>,
): Map<string, T> {
  const out = new Map<string, T>();
  for (const a of project.assets) {
    if (!wanted(a)) continue;
    const slot = cache.get(a.hash);
    if (slot?.state === 'ready') out.set(a.id, slot.value);
    else if (!slot) start(a).catch(() => undefined);
  }
  return out;
}

/** Imágenes listas por id de medio; las que falten se empiezan a cargar. */
export function imageSourcesFor(project: Project): ImageSources {
  return collect(project, images, (a) => a.mime.startsWith('image/'), loadImage);
}

/** Audio decodificado por id de medio; el que falte se empieza a decodificar. */
export function audioBuffersFor(project: Project): AudioBuffers {
  return collect(project, audio, (a) => a.mime.startsWith('audio/'), loadAudio);
}

export function mediaFailed(asset: Pick<Asset, 'hash'>): boolean {
  return images.get(asset.hash)?.state === 'error' || audio.get(asset.hash)?.state === 'error';
}

/** Picos de la forma de onda (100 por segundo), calculados una vez por audio. */
export function peaksOf(asset: Pick<Asset, 'hash'>): Float32Array | null {
  const cached = peaks.get(asset.hash);
  if (cached) return cached;
  const slot = audio.get(asset.hash);
  if (slot?.state !== 'ready') return null;
  const p = computePeaks(slot.value, 100);
  peaks.set(asset.hash, p);
  return p;
}

let realtime: AudioContext | null = null;
/** Contexto de reproducción (uno por ventana). */
export function audioContext(): AudioContext {
  realtime ??= new AudioContext({ latencyHint: 'interactive' });
  return realtime;
}

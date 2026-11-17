// Worker de exportación: dibuja cada fotograma con el mismo motor que la vista previa y lo codifica
// con WebCodecs (mediabunny). El MP4 sale por trozos hacia el hilo de interfaz, que los pasa al
// proceso principal; cada trozo espera confirmación, así que la memoria no crece con la duración.
import {
  AudioSample,
  AudioSampleSource,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  StreamTarget,
  type StreamTargetChunk,
} from 'mediabunny';
import { frameTick, type ExportQuality } from '@core/export/plan';
import { PathCache } from '@core/render/draw';
import { drawProjectFrame } from '@core/render/frame';
import type { FromWorker, MixedAudio, ToWorker } from './protocol';
import { loadFonts } from './worker-fonts';

/** Lo que se usa del ámbito del worker (tipado aparte para no mezclar las librerías DOM y WebWorker). */
declare const self: {
  fonts: FontFaceSet;
  postMessage(msg: FromWorker, transfer: Transferable[]): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

const QUALITY: Record<ExportQuality, typeof QUALITY_HIGH> = {
  normal: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  max: QUALITY_VERY_HIGH,
};
/** Tamaño de cada trozo enviado al proceso principal. */
const CHUNK_BYTES = 4 * 1024 ** 2;

class UserFacingError extends Error {}

const post = (msg: FromWorker, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

const pendingWrites = new Map<number, { resolve: () => void; reject: (e: Error) => void }>();
let nextWrite = 0;

function sendChunk(chunk: StreamTargetChunk): Promise<void> {
  const id = nextWrite++;
  const data = chunk.data.slice(); // copia propia: se transfiere sin tocar los búferes de mediabunny
  return new Promise((resolve, reject) => {
    pendingWrites.set(id, { resolve, reject });
    post({ type: 'write', id, position: chunk.position, data }, [data.buffer]);
  });
}

function audioSlice(audio: MixedAudio, from: number, to: number): AudioSample {
  const len = to - from;
  const planar = new Float32Array(len * audio.channels.length);
  audio.channels.forEach((ch, c) => planar.set(ch.subarray(from, to), c * len));
  return new AudioSample({
    data: planar,
    format: 'f32-planar',
    numberOfChannels: audio.channels.length,
    sampleRate: audio.sampleRate,
    timestamp: from / audio.sampleRate,
  });
}

async function run(msg: Extract<ToWorker, { type: 'start' }>): Promise<void> {
  const { project, plan, audio } = msg;
  await loadFonts(self.fonts);

  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], {
    width: plan.width,
    height: plan.height,
  });
  if (!videoCodec) throw new UserFacingError('Este equipo no puede codificar vídeo con este tamaño.');
  const audioCodec = audio
    ? await getFirstEncodableAudioCodec(['aac', 'opus'], {
        numberOfChannels: audio.channels.length,
        sampleRate: audio.sampleRate,
      })
    : null;
  if (audio && !audioCodec) throw new UserFacingError('Este equipo no puede codificar el audio (ni AAC ni Opus).');
  post({ type: 'codecs', video: videoCodec, audio: audioCodec });

  const canvas = new OffscreenCanvas(plan.width, plan.height);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const output = new Output({
    // Metadatos al final: escritura progresiva con memoria constante.
    format: new Mp4OutputFormat({ fastStart: false }),
    target: new StreamTarget(new WritableStream({ write: sendChunk }), { chunked: true, chunkSize: CHUNK_BYTES }),
  });
  const video = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY[msg.quality], keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: plan.fps });
  const audioSource =
    audio && audioCodec ? new AudioSampleSource({ codec: audioCodec, bitrate: QUALITY[msg.quality] }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const cache = new PathCache();
  const images = new Map(msg.images);
  const sx = plan.width / project.settings.width;
  const sy = plan.height / project.settings.height;
  const totalSamples = audio?.channels[0]?.length ?? 0;
  let audioCursor = 0;
  const feedAudioUntil = async (seconds: number) => {
    if (!audio || !audioSource) return;
    const until = Math.min(totalSamples, Math.ceil(seconds * audio.sampleRate));
    while (audioCursor < until) {
      const end = Math.min(until, audioCursor + audio.sampleRate);
      const sample = audioSlice(audio, audioCursor, end);
      await audioSource.add(sample);
      sample.close();
      audioCursor = end;
    }
  };

  for (let f = 0; f < plan.frames; f++) {
    const t = f / plan.fps;
    // El audio se intercala por segundos, un poco por delante del vídeo.
    await feedAudioUntil(t + 1);
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    drawProjectFrame(ctx, project, frameTick(f, plan.fps), cache, images);
    await video.add(t, 1 / plan.fps);
    if (f % 5 === 0) post({ type: 'progress', done: f, total: plan.frames });
  }
  await feedAudioUntil(Infinity);
  post({ type: 'progress', done: plan.frames, total: plan.frames });
  await output.finalize();
  for (const bmp of images.values()) bmp.close();
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'written' || msg.type === 'write-failed') {
    const p = pendingWrites.get(msg.id);
    pendingWrites.delete(msg.id);
    if (msg.type === 'written') p?.resolve();
    else p?.reject(new UserFacingError(msg.message));
    return;
  }
  run(msg).then(
    () => post({ type: 'done' }),
    (err: unknown) =>
      post({
        type: 'error',
        message:
          err instanceof UserFacingError
            ? err.message
            : `No se pudo exportar el vídeo (${err instanceof Error ? err.message : String(err)}).`,
      }),
  );
};

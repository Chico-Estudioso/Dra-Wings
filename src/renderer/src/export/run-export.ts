// Orquesta una exportación: destino (proceso principal), medios, mezcla de audio y worker.
import { usedAssetIds } from '@core/audio/clips';
import { scheduleProject } from '@core/audio/mix';
import { planExport, type ExportPlan, type ExportSettings } from '@core/export/plan';
import type { Project } from '@core/model/types';
import { secondsFromTicks } from '@core/time/ticks';
import { AUDIO_SAMPLE_RATE, loadAudio, loadImage } from '../editor/media';
import type { FromWorker, MixedAudio, ToWorker } from './protocol';

export type ExportStatus =
  | { phase: 'preparing' }
  | { phase: 'rendering'; done: number; total: number; codecs: { video: string; audio: string | null } | null }
  | { phase: 'finishing' };

export type ExportOutcome =
  | { status: 'ok'; fileName: string; seconds: number; codecs: { video: string; audio: string | null } | null }
  | { status: 'canceled' }
  | { status: 'error'; message: string };

export interface ExportRun {
  fileName: string;
  plan: ExportPlan;
  /** Se resuelve al terminar, con o sin éxito; nunca se rechaza. */
  result: Promise<ExportOutcome>;
  cancel(): void;
}

/** Códecs que se usarán (los mismos que elige el worker), para mostrarlos antes de exportar. */
export async function probeCodecs(
  width: number,
  height: number,
): Promise<{ video: string | null; audio: string | null }> {
  const mb = await import('mediabunny');
  const [video, audio] = await Promise.all([
    mb.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height }),
    mb.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: AUDIO_SAMPLE_RATE }),
  ]);
  return { video, audio };
}

export const hasAudibleClips = (p: Project) =>
  p.audioTracks.some((t) => !t.muted && t.volume > 0 && t.clips.length > 0);

/** Mezcla todo el audio del vídeo con la misma función que la reproducción, a 48 kHz y en estéreo. */
async function mixAudio(project: Project, plan: ExportPlan): Promise<MixedAudio | null> {
  if (!hasAudibleClips(project)) return null;
  const buffers = new Map<string, AudioBuffer>();
  for (const a of project.assets)
    if (a.mime.startsWith('audio/') && project.audioTracks.some((t) => t.clips.some((c) => c.assetId === a.id)))
      buffers.set(a.id, await loadAudio(a));
  const length = Math.max(1, Math.ceil(secondsFromTicks(plan.duration) * AUDIO_SAMPLE_RATE));
  const ctx = new OfflineAudioContext(2, length, AUDIO_SAMPLE_RATE);
  scheduleProject(ctx, project, buffers, 0, { to: plan.duration });
  const mixed = await ctx.startRendering();
  return {
    channels: [0, 1].map((c) => new Float32Array(mixed.getChannelData(Math.min(c, mixed.numberOfChannels - 1)))),
    sampleRate: AUDIO_SAMPLE_RATE,
  };
}

/** Copias de las imágenes usadas (el editor sigue usando las suyas). */
async function imagesFor(project: Project): Promise<[string, ImageBitmap][]> {
  const used = usedAssetIds(project);
  const out: [string, ImageBitmap][] = [];
  for (const a of project.assets)
    if (a.mime.startsWith('image/') && used.has(a.id)) out.push([a.id, await createImageBitmap(await loadImage(a))]);
  return out;
}

/**
 * Pide el destino y arranca la exportación. Devuelve null si el usuario cancela el diálogo de guardar.
 * Lanza un Error con un mensaje para el usuario si no se puede empezar.
 */
export async function startExport(
  project: Project,
  settings: ExportSettings,
  onStatus: (s: ExportStatus) => void,
): Promise<ExportRun | null> {
  const begin = await window.dw.exportBegin();
  if (begin.status === 'canceled') return null;
  if (begin.status === 'error') throw new Error(begin.message);
  const id = begin.id;
  const plan = planExport(project, settings);
  let worker: Worker | null = null;
  let finished = false;
  let resolveResult!: (o: ExportOutcome) => void;
  const result = new Promise<ExportOutcome>((r) => (resolveResult = r));
  const t0 = performance.now();
  let codecs: { video: string; audio: string | null } | null = null;

  const end = async (o: ExportOutcome) => {
    if (finished) return;
    finished = true;
    worker?.terminate();
    if (o.status !== 'ok') await window.dw.exportCancel(id).catch(() => undefined);
    resolveResult(o);
  };

  void (async () => {
    try {
      onStatus({ phase: 'preparing' });
      let images: [string, ImageBitmap][];
      let audio: MixedAudio | null;
      try {
        images = await imagesFor(project);
        audio = await mixAudio(project, plan);
      } catch {
        return end({
          status: 'error',
          message: 'No se pudo leer alguna imagen o audio del proyecto. Vuelve a importarlo y exporta de nuevo.',
        });
      }
      if (finished) return;
      worker = new Worker(new URL('./export-worker.ts', import.meta.url), { type: 'module' });
      const send = (msg: ToWorker, transfer: Transferable[] = []) => worker?.postMessage(msg, transfer);
      worker.onerror = (e) => void end({ status: 'error', message: `No se pudo exportar el vídeo (${e.message}).` });
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        switch (msg.type) {
          case 'codecs':
            codecs = { video: msg.video, audio: msg.audio };
            break;
          case 'progress':
            onStatus({ phase: 'rendering', done: msg.done, total: msg.total, codecs });
            break;
          case 'write':
            window.dw.exportWrite(id, msg.position, msg.data).then(
              () => send({ type: 'written', id: msg.id }),
              () =>
                send({
                  type: 'write-failed',
                  id: msg.id,
                  message: 'No se pudo escribir el vídeo. Comprueba que hay espacio libre en el disco.',
                }),
            );
            break;
          case 'done':
            onStatus({ phase: 'finishing' });
            void window.dw.exportFinish(id).then((r) => {
              finished = true;
              worker?.terminate();
              resolveResult(
                r.status === 'ok'
                  ? { status: 'ok', fileName: r.fileName, seconds: (performance.now() - t0) / 1000, codecs }
                  : r,
              );
            });
            break;
          case 'error':
            void end({ status: 'error', message: msg.message });
            break;
        }
      };
      send({ type: 'start', project, plan, quality: settings.quality, images, audio }, [
        ...images.map(([, b]) => b),
        ...(audio?.channels.map((c) => c.buffer) ?? []),
      ]);
    } catch (e) {
      void end({ status: 'error', message: e instanceof Error ? e.message : 'No se pudo exportar el vídeo.' });
    }
  })();

  return { fileName: begin.fileName, plan, result, cancel: () => void end({ status: 'canceled' }) };
}

// Detectar el ritmo de la música: decodifica el audio, lo analiza en un worker y guarda los golpes
// en el medio (un paso de deshacer).
import { create } from 'zustand';
import type { BeatAnalysis } from '@core/audio/beats';
import { downmix } from '@core/audio/wav';
import { ticksFromSeconds } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { loadAudio } from './media';

/** Medios que se están analizando. */
export const useRhythm = create<{ busy: ReadonlySet<string> }>(() => ({ busy: new Set() }));

const setBusy = (assetId: string, on: boolean) =>
  useRhythm.setState((s) => {
    const busy = new Set(s.busy);
    if (on) busy.add(assetId);
    else busy.delete(assetId);
    return { busy };
  });

function analyze(samples: Float32Array, sampleRate: number): Promise<BeatAnalysis | null> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./beat-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<BeatAnalysis | null>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ samples, sampleRate }, [samples.buffer]);
  });
}

/** Detecta el ritmo de un medio de audio del proyecto y lo guarda. */
export async function detectRhythm(assetId: string, { quiet = false } = {}): Promise<void> {
  const app = useApp.getState();
  const asset = app.doc?.project.assets.find((a) => a.id === assetId);
  if (!asset || useRhythm.getState().busy.has(assetId)) return;
  setBusy(assetId, true);
  try {
    const buffer = await loadAudio(asset);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    // Copia: el búfer decodificado se comparte con la reproducción y no se puede transferir.
    const mono = Float32Array.from(downmix(channels));
    const result = await analyze(mono, buffer.sampleRate);
    if (!result) {
      if (!quiet) app.notify({ kind: 'info', text: `No se ha encontrado un ritmo claro en «${asset.name}».` });
      return;
    }
    useApp.getState().apply('Detectar ritmo', (draft) => {
      const a = draft.assets.find((x) => x.id === assetId);
      if (a)
        a.beats = {
          bpm: result.bpm,
          ticks: result.beats.map((s) => ticksFromSeconds(s)),
          downbeat: result.downbeat,
        };
    });
  } catch {
    if (!quiet) app.notify({ kind: 'error', text: `No se pudo analizar el ritmo de «${asset.name}».` });
  } finally {
    setBusy(assetId, false);
  }
}

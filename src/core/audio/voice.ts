// Voz de la narración para que los personajes hablen: volumen por fotograma (30 por segundo),
// normalizado a la propia grabación y suavizado (sube enseguida, baja más despacio, como una boca).
import { sceneStart } from '../edit/scenes';
import type { Project } from '../model/types';
import { TICKS_PER_SECOND, type Ticks } from '../time/ticks';

export const VOICE_RATE = 30;

/** Nivel de voz 0..100 cada 1/30 s. */
export function voiceEnvelope(samples: Float32Array, sampleRate: number): number[] {
  const win = Math.max(1, Math.round(sampleRate / VOICE_RATE));
  const frames = Math.ceil(samples.length / win);
  const db: number[] = [];
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const end = Math.min(samples.length, (f + 1) * win);
    for (let i = f * win; i < end; i++) sum += samples[i]! * samples[i]!;
    const rms = Math.sqrt(sum / Math.max(1, end - f * win));
    db.push(20 * Math.log10(rms + 1e-9));
  }
  // Referencia: el percentil 95 (la voz fuerte); 30 dB por debajo ya es silencio.
  const sorted = [...db].sort((a, b) => a - b);
  const peak = sorted[Math.floor(sorted.length * 0.95)] ?? -100;
  if (peak < -60) return db.map(() => 0);
  const floor = peak - 30;
  let level = 0;
  return db.map((d) => {
    const x = Math.max(0, Math.min(1, (d - floor) / (peak - floor)));
    level = x > level ? x : level * 0.6 + x * 0.4;
    return Math.round(level * 100);
  });
}

/** Nivel de voz (0..1) de las narraciones que suenan en el instante global `tick`. */
export function voiceLevel(project: Project, tick: Ticks): number {
  let best = 0;
  for (const track of project.audioTracks) {
    if (track.kind !== 'narration' || track.muted) continue;
    for (const clip of track.clips) {
      if (tick < clip.start || tick >= clip.start + clip.duration) continue;
      const voice = project.assets.find((a) => a.id === clip.assetId)?.voice;
      if (!voice) continue;
      const i = Math.floor(((tick - clip.start + clip.sourceOffset) / TICKS_PER_SECOND) * voice.rate);
      best = Math.max(best, (voice.levels[i] ?? 0) / 100);
    }
  }
  return best;
}

/** Nivel de voz en el tiempo local de una escena. */
export function sceneVoice(project: Project, sceneId: string): (local: Ticks) => number {
  const start = sceneStart(project, sceneId);
  return (local) => voiceLevel(project, start + local);
}

/** ¿Hay alguna narración con la voz analizada? */
export const hasVoice = (project: Project) =>
  project.audioTracks.some(
    (t) => t.kind === 'narration' && t.clips.some((c) => project.assets.find((a) => a.id === c.assetId)?.voice),
  );

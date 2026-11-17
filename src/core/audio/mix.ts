// Construcción del grafo de audio a partir del documento. La usan la reproducción (AudioContext)
// y la exportación (OfflineAudioContext), así que el vídeo suena igual que la vista previa.
import type { Project } from '../model/types';
import { secondsFromTicks, type Ticks } from '../time/ticks';
import { scheduleFrom } from './clips';

export type AudioBuffers = ReadonlyMap<string, AudioBuffer>;

export interface Scheduled {
  stop(): void;
}

/**
 * Programa todos los clips que suenan desde el instante global `from`, empezando a sonar en
 * `ctx.currentTime + startDelay` segundos. Devuelve un control para detenerlos.
 */
export function scheduleProject(
  ctx: BaseAudioContext,
  project: Project,
  buffers: AudioBuffers,
  from: Ticks,
  opts: { startDelay?: number; to?: Ticks; destination?: AudioNode } = {},
): Scheduled {
  const t0 = ctx.currentTime + (opts.startDelay ?? 0);
  const master = ctx.createGain();
  master.connect(opts.destination ?? ctx.destination);
  const sources: AudioBufferSourceNode[] = [];
  for (const s of scheduleFrom(project, from, opts.to)) {
    const buffer = buffers.get(s.clip.assetId);
    if (!buffer) continue;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    const when = t0 + secondsFromTicks(s.delay);
    const length = secondsFromTicks(s.length);
    // Fundidos como rampas sobre el tramo que suena (si se empieza a mitad de un fundido, desde su valor).
    const c = s.clip;
    const g = (t: Ticks) => {
      let v = c.gain * s.track.volume;
      if (c.fadeIn > 0 && t < c.fadeIn) v *= t / c.fadeIn;
      if (c.fadeOut > 0 && c.duration - t < c.fadeOut) v *= (c.duration - t) / c.fadeOut;
      return Math.max(0, v);
    };
    gain.gain.setValueAtTime(g(s.clipOffset), when);
    if (c.fadeIn > 0 && s.clipOffset < c.fadeIn)
      gain.gain.linearRampToValueAtTime(g(c.fadeIn), when + secondsFromTicks(c.fadeIn - s.clipOffset));
    if (c.fadeOut > 0) {
      const fadeStart = Math.max(s.clipOffset, c.duration - c.fadeOut);
      gain.gain.setValueAtTime(g(fadeStart), when + secondsFromTicks(fadeStart - s.clipOffset));
      gain.gain.linearRampToValueAtTime(0, when + length);
    }
    src.connect(gain).connect(master);
    src.start(when, secondsFromTicks(s.sourceStart), length);
    sources.push(src);
  }
  return {
    stop() {
      for (const s of sources)
        try {
          s.stop();
        } catch {
          /* ya detenido */
        }
      master.disconnect();
    },
  };
}

/** Picos de una forma de onda: [mín, máx] por bloque, `perSecond` bloques por segundo. */
export function computePeaks(buffer: AudioBuffer, perSecond = 100): Float32Array {
  const ch = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(buffer.sampleRate / perSecond));
  const n = Math.ceil(ch.length / block);
  const out = new Float32Array(n * 2);
  for (let b = 0; b < n; b++) {
    let min = 0;
    let max = 0;
    const end = Math.min(ch.length, (b + 1) * block);
    for (let i = b * block; i < end; i++) {
      const v = ch[i]!;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    out[b * 2] = min;
    out[b * 2 + 1] = max;
  }
  return out;
}

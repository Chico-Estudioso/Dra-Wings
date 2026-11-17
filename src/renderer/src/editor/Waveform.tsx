import { useEffect, useRef } from 'react';
import type { Asset } from '@core/model/types';
import { secondsFromTicks, type Ticks } from '@core/time/ticks';
import { loadAudio, peaksOf, useMediaVersion } from './media';

const PEAKS_PER_SECOND = 100;
/** Ancho máximo del lienzo de la onda: a más zoom se estira (la onda no gana detalle útil). */
const MAX_CANVAS_W = 4096;

/** Forma de onda del tramo [sourceStart, sourceStart + sourceLength) de un audio. */
export function Waveform({
  asset,
  sourceStart,
  sourceLength,
  width,
  height,
  gain,
}: {
  asset: Asset;
  sourceStart: Ticks;
  sourceLength: Ticks;
  width: number;
  height: number;
  gain: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const version = useMediaVersion((s) => s.v);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.min(MAX_CANVAS_W, Math.round(width * dpr)));
    const H = Math.max(1, Math.round(height * dpr));
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const peaks = peaksOf(asset);
    if (!peaks) {
      loadAudio(asset).catch(() => undefined);
      return;
    }
    const blocks = peaks.length / 2;
    const b0 = secondsFromTicks(sourceStart) * PEAKS_PER_SECOND;
    const perPx = (secondsFromTicks(sourceLength) * PEAKS_PER_SECOND) / W;
    const k = Math.min(2, gain) * (H / 2);
    ctx.fillStyle = getComputedStyle(canvas).color;
    for (let x = 0; x < W; x++) {
      const from = Math.floor(b0 + x * perPx);
      const to = Math.max(from + 1, Math.floor(b0 + (x + 1) * perPx));
      let min = 0;
      let max = 0;
      for (let b = from; b < to && b < blocks; b++) {
        if (peaks[b * 2]! < min) min = peaks[b * 2]!;
        if (peaks[b * 2 + 1]! > max) max = peaks[b * 2 + 1]!;
      }
      const top = H / 2 - Math.min(1, max) * k;
      ctx.fillRect(x, top, 1, Math.max(1, (Math.min(1, max) - Math.max(-1, min)) * k));
    }
  }, [asset, sourceStart, sourceLength, width, height, gain, version]);

  return <canvas ref={ref} className="tl-wave" style={{ width, height }} aria-hidden />;
}

// Base temporal entera (ADR-006): 1 segundo = 705 600 000 ticks.
export type Ticks = number;

export const TICKS_PER_SECOND = 705_600_000;
export const SUPPORTED_FPS = [24, 25, 30, 48, 50, 60] as const;
export type Fps = (typeof SUPPORTED_FPS)[number];

export function isSupportedFps(value: number): value is Fps {
  return (SUPPORTED_FPS as readonly number[]).includes(value);
}

export function ticksPerFrame(fps: Fps): Ticks {
  return TICKS_PER_SECOND / fps;
}

export function ticksFromFrame(frame: number, fps: Fps): Ticks {
  return frame * ticksPerFrame(fps);
}

/** Fotograma que se muestra en un instante (el que empieza en o antes de `ticks`). */
export function frameAt(ticks: Ticks, fps: Fps): number {
  return Math.floor(ticks / ticksPerFrame(fps));
}

/** Convierte segundos a ticks redondeando al tick más cercano. Solo para fronteras con APIs externas. */
export function ticksFromSeconds(seconds: number): Ticks {
  return Math.round(seconds * TICKS_PER_SECOND);
}

export function secondsFromTicks(ticks: Ticks): number {
  return ticks / TICKS_PER_SECOND;
}

/** Ajusta un tiempo a la rejilla de fotogramas (hacia el fotograma más cercano). */
export function snapToFrame(ticks: Ticks, fps: Fps): Ticks {
  const tpf = ticksPerFrame(fps);
  return Math.round(ticks / tpf) * tpf;
}

/** Código de tiempo `mm:ss:ff` (o `h:mm:ss:ff` a partir de una hora). */
export function formatTimecode(ticks: Ticks, fps: Fps): string {
  const totalFrames = frameAt(Math.max(0, ticks), fps);
  const ff = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const ss = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mm = totalMinutes % 60;
  const hh = Math.floor(totalMinutes / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}:${pad(ff)}` : `${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

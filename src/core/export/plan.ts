// Plan de una exportación: tamaño, fotogramas e instantes. Sin dependencias del navegador.
import { projectDuration } from '../edit/scenes';
import type { Project } from '../model/types';
import { ticksPerFrame, type Fps, type Ticks } from '../time/ticks';

export type Resolution = '720p' | '1080p';
export type ExportQuality = 'normal' | 'high' | 'max';

export interface ExportSettings {
  resolution: Resolution;
  fps: Fps;
  quality: ExportQuality;
}

const SHORT_SIDE: Record<Resolution, number> = { '720p': 720, '1080p': 1080 };
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Tamaño del vídeo: el lado corto de la resolución elegida, con la proporción de la hoja (lados pares). */
export function exportSize(settings: Pick<Project['settings'], 'width' | 'height'>, resolution: Resolution) {
  const short = SHORT_SIDE[resolution];
  const { width, height } = settings;
  return width >= height
    ? { width: even((short * width) / height), height: short }
    : { width: short, height: even((short * height) / width) };
}

/** Ajustes iniciales del diálogo a partir de lo guardado en el proyecto. */
export function defaultExportSettings(project: Project): ExportSettings {
  return {
    resolution: project.export.preset === '720p' ? '720p' : '1080p',
    fps: project.export.fps ?? project.settings.fps,
    quality: 'high',
  };
}

export interface ExportPlan {
  width: number;
  height: number;
  fps: Fps;
  /** Duración total en ticks. */
  duration: Ticks;
  frames: number;
}

export function planExport(project: Project, s: ExportSettings): ExportPlan {
  const duration = projectDuration(project);
  return {
    ...exportSize(project.settings, s.resolution),
    fps: s.fps,
    duration,
    frames: Math.max(1, Math.ceil(duration / ticksPerFrame(s.fps))),
  };
}

/** Instante (global) del fotograma `f`: exacto, porque los ticks son divisibles por todos los FPS admitidos. */
export const frameTick = (f: number, fps: Fps): Ticks => f * ticksPerFrame(fps);

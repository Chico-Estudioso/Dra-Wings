import { nanoid } from 'nanoid';
import { TICKS_PER_SECOND, type Fps } from '../time/ticks';
import type { Layer, Mode, Project, Scene, Transform } from './types';

export const ASPECT_PRESETS = {
  landscape: { label: 'Horizontal 16:9', width: 1920, height: 1080, exportPreset: '1080p' },
  square: { label: 'Cuadrado 1:1', width: 1080, height: 1080, exportPreset: 'square' },
  vertical: { label: 'Vertical 9:16', width: 1080, height: 1920, exportPreset: 'vertical' },
} as const;

export type AspectPreset = keyof typeof ASPECT_PRESETS;

export const newId = (): string => nanoid(12);

export function identityTransform(x = 0, y = 0): Transform {
  return {
    x: { value: x },
    y: { value: y },
    scaleX: { value: 1 },
    scaleY: { value: 1 },
    rotation: { value: 0 },
    anchorX: 0,
    anchorY: 0,
  };
}

export function createLayer(name: string, kind: Layer['kind'] = 'vector'): Layer {
  return {
    id: newId(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    kind,
    ...(kind === 'vector' ? { items: [] } : { cels: [] }),
  };
}

export function createScene(name: string, durationSeconds = 5): Scene {
  return {
    id: newId(),
    name,
    duration: durationSeconds * TICKS_PER_SECOND,
    layers: [createLayer('Capa 1')],
    camera: identityTransform(),
  };
}

export interface NewProjectOptions {
  name: string;
  aspect: AspectPreset;
  fps: Fps;
  mode: Mode;
  now?: Date;
}

export function createProject({ name, aspect, fps, mode, now = new Date() }: NewProjectOptions): Project {
  const preset = ASPECT_PRESETS[aspect];
  const iso = now.toISOString();
  return {
    id: newId(),
    name: name.trim(),
    createdAt: iso,
    updatedAt: iso,
    settings: { width: preset.width, height: preset.height, fps, background: '#ffffff', mode },
    scenes: [createScene('Escena 1')],
    assets: [],
    audioTracks: [],
    markers: [],
    export: { preset: preset.exportPreset },
  };
}

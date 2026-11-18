import { nanoid } from 'nanoid';
import { TICKS_PER_SECOND, type Fps } from '../time/ticks';
import type { ImageItem, Layer, Mode, Project, Scene, Shape, Stroke, TextItem, Transform } from './types';

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
    settings: {
      width: preset.width,
      height: preset.height,
      fps,
      background: '#ffffff',
      mode,
      boil: 'medium',
      elastic: 'medium',
    },
    scenes: [createScene('Escena 1')],
    assets: [],
    audioTracks: [],
    markers: [],
    export: { preset: preset.exportPreset },
  };
}

// Elementos. El ancla (centro de rotación y escala) es el centro de su caja local.

export interface StrokeStyleInput {
  color: string;
  size: number;
  opacity: number;
  thinning?: number;
  smoothing?: number;
  streamline?: number;
  taper?: number;
}

/** `points` empaquetados [x, y, presión, tMs, ...] en coordenadas de escena. */
export function createStroke(points: number[], style: StrokeStyleInput): Stroke {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < points.length; i += 4) {
    x0 = Math.min(x0, points[i]!);
    y0 = Math.min(y0, points[i + 1]!);
    x1 = Math.max(x1, points[i]!);
    y1 = Math.max(y1, points[i + 1]!);
  }
  const t = identityTransform();
  t.anchorX = (x0 + x1) / 2;
  t.anchorY = (y0 + y1) / 2;
  return {
    id: newId(),
    type: 'stroke',
    transform: t,
    opacity: { value: 1 },
    in: 0,
    points,
    style: {
      color: style.color,
      size: style.size,
      opacity: style.opacity,
      thinning: style.thinning ?? 0.55,
      smoothing: style.smoothing ?? 0.5,
      streamline: style.streamline ?? 0.45,
      ...(style.taper ? { taper: style.taper } : {}),
    },
  };
}

export function createShape(
  shape: Shape['shape'],
  x: number,
  y: number,
  w: number,
  h: number,
  style: Shape['style'],
): Shape {
  const line = shape === 'line' || shape === 'arrow';
  const nx = line ? x : Math.min(x, x + w);
  const ny = line ? y : Math.min(y, y + h);
  const nw = line ? w : Math.abs(w);
  const nh = line ? h : Math.abs(h);
  const t = identityTransform(nx, ny);
  t.anchorX = nw / 2;
  t.anchorY = nh / 2;
  return { id: newId(), type: 'shape', shape, transform: t, opacity: { value: 1 }, in: 0, w: nw, h: nh, style };
}

export function createText(
  x: number,
  y: number,
  props: Pick<TextItem, 'text' | 'font' | 'size' | 'color' | 'align' | 'lineHeight' | 'w' | 'h'>,
): TextItem {
  const t = identityTransform(x, y);
  t.anchorX = props.w / 2;
  t.anchorY = props.h / 2;
  return { id: newId(), type: 'text', transform: t, opacity: { value: 1 }, in: 0, ...props };
}

/** Imagen importada de `w`×`h` unidades de escena con la esquina superior izquierda en (x, y). */
export function createImage(assetId: string, x: number, y: number, w: number, h: number, name?: string): ImageItem {
  const t = identityTransform(x, y);
  t.anchorX = w / 2;
  t.anchorY = h / 2;
  return {
    id: newId(),
    type: 'image',
    ...(name ? { name } : {}),
    transform: t,
    opacity: { value: 1 },
    in: 0,
    assetId,
    w,
    h,
  };
}

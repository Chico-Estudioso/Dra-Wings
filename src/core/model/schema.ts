// Esquema del documento `.dwings` v1 (ver docs/PROJECT_FORMAT.md).
// Es la fuente de verdad de la validación y de los tipos.
import { z } from 'zod';
import { SUPPORTED_FPS } from '../time/ticks';

export const FORMAT_ID = 'dra-wings';
export const CURRENT_FORMAT_VERSION = 1;

const id = z.string().min(1).max(64);
const ticks = z.number().int().nonnegative();
const color = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Color no válido');
const unit = z.number().min(0).max(1);

export const fpsSchema = z.literal(SUPPORTED_FPS);
export const modeSchema = z.enum(['guided', 'mixed', 'free']);
export const easeSchema = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold']);

export const animatedNumberSchema = z.union([
  z.object({ value: z.number() }),
  z.object({
    keys: z
      .array(z.object({ t: ticks, v: z.number(), ease: easeSchema }))
      .min(1)
      .refine((keys) => keys.every((k, i) => i === 0 || k.t > keys[i - 1]!.t), 'Los keyframes deben estar ordenados'),
  }),
]);

export const transformSchema = z.object({
  x: animatedNumberSchema,
  y: animatedNumberSchema,
  scaleX: animatedNumberSchema,
  scaleY: animatedNumberSchema,
  rotation: animatedNumberSchema,
  anchorX: z.number(),
  anchorY: z.number(),
});

const itemBase = {
  id,
  name: z.string().max(200).optional(),
  transform: transformSchema,
  opacity: animatedNumberSchema,
  in: ticks,
  out: ticks.optional(),
};

export const strokeSchema = z.object({
  ...itemBase,
  type: z.literal('stroke'),
  // Empaquetado [x, y, presión, tMs, ...]. Presión -1 = el dispositivo no la proporciona.
  points: z
    .array(z.number())
    .max(4 * 100_000)
    .refine((p) => p.length % 4 === 0, 'Los puntos deben ir en grupos de 4'),
  style: z.object({
    color,
    size: z.number().positive().max(500),
    thinning: z.number().min(-1).max(1),
    smoothing: unit,
    streamline: unit,
    opacity: unit,
  }),
  reveal: z.object({ start: ticks, duration: ticks, mode: z.enum(['length', 'recorded']) }).nullable(),
});

// Los demás tipos de elemento (forma, texto, imagen, biblioteca y grupo) se añaden en M2 y M3.
export const itemSchema = z.discriminatedUnion('type', [strokeSchema]);

export const celSchema = z.object({ id, start: ticks, duration: ticks.positive(), items: z.array(itemSchema) });

export const layerSchema = z
  .object({
    id,
    name: z.string().min(1).max(200),
    visible: z.boolean(),
    locked: z.boolean(),
    opacity: unit,
    kind: z.enum(['vector', 'frames']),
    items: z.array(itemSchema).optional(),
    cels: z.array(celSchema).optional(),
  })
  .refine((l) => (l.kind === 'vector' ? l.items !== undefined : l.cels !== undefined), {
    message: 'La capa no tiene el contenido que corresponde a su tipo',
  });

export const sceneSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  duration: ticks.positive(),
  layers: z.array(layerSchema),
  camera: transformSchema,
});

export const assetSchema = z.object({
  id,
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  mime: z.string().max(100),
  name: z.string().max(260),
  size: z.number().int().nonnegative(),
  durationTicks: ticks.optional(),
});

export const audioClipSchema = z.object({
  id,
  assetId: id,
  start: ticks,
  sourceOffset: ticks,
  duration: ticks.positive(),
  gain: z.number().min(0).max(4),
  fadeIn: ticks,
  fadeOut: ticks,
});

export const audioTrackSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  kind: z.enum(['narration', 'music', 'sfx']),
  volume: z.number().min(0).max(4),
  muted: z.boolean(),
  clips: z.array(audioClipSchema),
});

export const markerSchema = z.object({ id, t: ticks, label: z.string().max(200) });

export const projectSchema = z.object({
  id,
  name: z.string().trim().min(1, 'El proyecto necesita un nombre').max(200),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  settings: z.object({
    width: z.number().int().min(16).max(7680),
    height: z.number().int().min(16).max(7680),
    fps: fpsSchema,
    background: color,
    mode: modeSchema,
  }),
  scenes: z.array(sceneSchema).min(1, 'El proyecto necesita al menos una escena'),
  assets: z.array(assetSchema),
  audioTracks: z.array(audioTrackSchema),
  markers: z.array(markerSchema),
  export: z.object({
    preset: z.enum(['720p', '1080p', 'square', 'vertical']),
    fps: fpsSchema.optional(),
  }),
});

export const manifestSchema = z.object({
  format: z.literal(FORMAT_ID),
  formatVersion: z.number().int().positive(),
  appVersion: z.string().max(50),
});

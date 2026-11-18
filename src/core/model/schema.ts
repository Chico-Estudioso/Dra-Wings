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
export const easeSchema = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold', 'back', 'bounce']);

export const animatedNumberSchema = z.union([
  z.object({ value: z.number() }),
  z.object({
    keys: z
      .array(z.object({ t: ticks, v: z.number(), ease: easeSchema }))
      .min(1)
      .refine((keys) => keys.every((k, i) => i === 0 || k.t > keys[i - 1]!.t), 'Los keyframes deben estar ordenados'),
  }),
]);

// Rotación en grados. Matriz: T(x + anchorX, y + anchorY) · R(rotation) · S(scaleX, scaleY) · T(-anchorX, -anchorY).
export const transformSchema = z.object({
  x: animatedNumberSchema,
  y: animatedNumberSchema,
  scaleX: animatedNumberSchema,
  scaleY: animatedNumberSchema,
  rotation: animatedNumberSchema,
  anchorX: z.number(),
  anchorY: z.number(),
});

/** Animación de entrada: dibujarse (trazos, contornos, texto letra a letra), fundido o «pop». */
export const enterSchema = z.object({
  kind: z.enum(['none', 'draw', 'fade', 'pop']),
  duration: ticks,
  /** Solo trazos: revelar por longitud (velocidad constante) o con los tiempos grabados al dibujar. */
  mode: z.enum(['length', 'recorded']).optional(),
});
export const exitSchema = z.object({ kind: z.enum(['none', 'fade', 'pop']), duration: ticks });

const itemBase = {
  id,
  name: z.string().max(200).optional(),
  // Ranura de color dentro de un recurso de biblioteca (piel, pelo, ropa…) para recolorearlo en bloque.
  slot: z.string().max(40).optional(),
  transform: transformSchema,
  opacity: animatedNumberSchema,
  /** Instante (relativo a la escena) en que empieza a aparecer. */
  in: ticks,
  /** Instante en que termina de desaparecer (sin valor: hasta el final de la escena). */
  out: ticks.optional(),
  enter: enterSchema.optional(),
  exit: exitSchema.optional(),
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
    /** Afinado de las puntas (distancia en unidades locales); sin valor, puntas redondas. */
    taper: z.number().nonnegative().max(10_000).optional(),
  }),
});

export const shapeSchema = z.object({
  ...itemBase,
  type: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'line', 'arrow', 'polygon']),
  // rect/ellipse/polygon: caja local (0,0)-(w,h). line/arrow: segmento de (0,0) a (w,h); w y h pueden ser negativos.
  w: z.number().finite().min(-100_000).max(100_000),
  h: z.number().finite().min(-100_000).max(100_000),
  // Solo polygon: vértices locales [x0, y0, x1, y1, ...], cerrado y con esquinas suavizadas opcionalmente.
  points: z
    .array(z.number().finite())
    .max(2 * 2000)
    .refine((p) => p.length % 2 === 0, 'Los vértices deben ir en pares')
    .optional(),
  smooth: z.boolean().optional(),
  style: z.object({
    stroke: color.nullable(),
    strokeWidth: z.number().min(0).max(200),
    fill: color.nullable(),
    opacity: unit,
  }),
});

export const FONT_IDS = ['hand', 'script', 'rounded'] as const;

export const textSchema = z.object({
  ...itemBase,
  type: z.literal('text'),
  text: z.string().max(5000),
  font: z.enum(FONT_IDS),
  size: z.number().positive().max(1000),
  color,
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().min(0.5).max(3),
  // Caja medida al editar el texto: la selección y el ajuste no dependen de medir en cada render.
  w: z.number().nonnegative().max(100_000),
  h: z.number().nonnegative().max(100_000),
});

/** Imagen importada: referencia a un medio del proyecto, dibujada en la caja local (0,0)-(w,h). */
export const imageSchema = z.object({
  ...itemBase,
  type: z.literal('image'),
  assetId: id,
  w: z.number().positive().max(100_000),
  h: z.number().positive().max(100_000),
});

export const colorSlotSchema = z.object({ id: z.string().min(1).max(40), label: z.string().max(80), color });

type ItemBase = z.infer<z.ZodObject<typeof itemBase>>;

/** Grupo de elementos (por ejemplo, un recurso de la biblioteca). Los hijos están en coordenadas locales. */
export interface GroupItem extends ItemBase {
  type: 'group';
  children: AnyItem[];
  w: number;
  h: number;
  /** Origen en la biblioteca (informativo: el grupo es autosuficiente). */
  source?: { kind: 'library' | 'character'; id: string };
  slots?: z.infer<typeof colorSlotSchema>[];
  /** Cambios de dibujo en el tiempo (por ejemplo, otra expresión o postura), ordenados por `t`. */
  swaps?: GroupSwap[];
}

/** Desde el instante `t` (de la escena), el grupo se dibuja con estos hijos (mismas coordenadas locales). */
export interface GroupSwap {
  t: number;
  children: AnyItem[];
  /** Aspecto que representa (en personajes, `pelo/expresión/postura`). */
  variant?: string;
}

export type AnyItem =
  | z.infer<typeof strokeSchema>
  | z.infer<typeof shapeSchema>
  | z.infer<typeof textSchema>
  | z.infer<typeof imageSchema>
  | GroupItem;

export const groupSchema = z.object({
  ...itemBase,
  type: z.literal('group'),
  get children(): z.ZodArray<z.ZodType<AnyItem>> {
    return z.array(itemSchema).max(5000);
  },
  w: z.number().nonnegative().max(100_000),
  h: z.number().nonnegative().max(100_000),
  source: z.object({ kind: z.enum(['library', 'character']), id: z.string().max(80) }).optional(),
  slots: z.array(colorSlotSchema).max(20).optional(),
  get swaps(): z.ZodOptional<z.ZodArray<z.ZodType<GroupSwap>>> {
    return z.array(swapSchema).max(200).optional();
  },
});

export const swapSchema: z.ZodType<GroupSwap> = z.object({
  t: ticks,
  get children(): z.ZodArray<z.ZodType<AnyItem>> {
    return z.array(itemSchema).max(5000);
  },
  variant: z.string().max(80).optional(),
});

export const itemSchema: z.ZodType<AnyItem> = z.discriminatedUnion('type', [
  strokeSchema,
  shapeSchema,
  textSchema,
  imageSchema,
  groupSchema,
]);

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
    /** «Trazo vivo»: temblor de las líneas al reproducir y en el vídeo (sin valor: quieto). */
    boil: z.enum(['off', 'soft', 'medium', 'strong']).optional(),
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

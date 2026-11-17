import type { z } from 'zod';
import type {
  animatedNumberSchema,
  assetSchema,
  audioClipSchema,
  audioTrackSchema,
  celSchema,
  colorSlotSchema,
  layerSchema,
  manifestSchema,
  markerSchema,
  modeSchema,
  projectSchema,
  sceneSchema,
  shapeSchema,
  strokeSchema,
  textSchema,
  imageSchema,
  transformSchema,
} from './schema';
import type { AnyItem, GroupItem } from './schema';

export type Project = z.infer<typeof projectSchema>;
export type ProjectSettings = Project['settings'];
export type Mode = z.infer<typeof modeSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type Item = AnyItem;
export type Stroke = z.infer<typeof strokeSchema>;
export type Cel = z.infer<typeof celSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AudioTrack = z.infer<typeof audioTrackSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type Marker = z.infer<typeof markerSchema>;
export type AnimatedNumber = z.infer<typeof animatedNumberSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type Shape = z.infer<typeof shapeSchema>;
export type TextItem = z.infer<typeof textSchema>;
export type FontId = TextItem['font'];
export type Group = GroupItem;
export type ColorSlot = z.infer<typeof colorSlotSchema>;
export type Enter = NonNullable<Item['enter']>;
export type Exit = NonNullable<Item['exit']>;
export type ImageItem = z.infer<typeof imageSchema>;

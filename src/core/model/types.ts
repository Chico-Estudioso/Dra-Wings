import type { z } from 'zod';
import type {
  animatedNumberSchema,
  assetSchema,
  audioClipSchema,
  audioTrackSchema,
  celSchema,
  itemSchema,
  layerSchema,
  manifestSchema,
  markerSchema,
  modeSchema,
  projectSchema,
  sceneSchema,
  strokeSchema,
  transformSchema,
} from './schema';

export type Project = z.infer<typeof projectSchema>;
export type ProjectSettings = Project['settings'];
export type Mode = z.infer<typeof modeSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Stroke = z.infer<typeof strokeSchema>;
export type Cel = z.infer<typeof celSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AudioTrack = z.infer<typeof audioTrackSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type Marker = z.infer<typeof markerSchema>;
export type AnimatedNumber = z.infer<typeof animatedNumberSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

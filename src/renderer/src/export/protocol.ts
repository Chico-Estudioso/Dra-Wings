// Mensajes entre el hilo de interfaz y el worker de exportación.
import type { ExportPlan, ExportQuality } from '@core/export/plan';
import type { Project } from '@core/model/types';

export interface MixedAudio {
  /** Canales planos (izquierdo y derecho) a `sampleRate`, del inicio al final del vídeo. */
  channels: Float32Array[];
  sampleRate: number;
}

export type ToWorker =
  | {
      type: 'start';
      project: Project;
      plan: ExportPlan;
      quality: ExportQuality;
      images: [string, ImageBitmap][];
      audio: MixedAudio | null;
    }
  | { type: 'written'; id: number }
  | { type: 'write-failed'; id: number; message: string };

export type FromWorker =
  | { type: 'codecs'; video: string; audio: string | null }
  | { type: 'progress'; done: number; total: number }
  | { type: 'write'; id: number; position: number; data: Uint8Array }
  | { type: 'done' }
  | { type: 'error'; message: string };

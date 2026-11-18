// Contrato IPC entre el proceso principal, el preload y el renderer.
// El proceso principal es la única autoridad sobre rutas de archivo: el renderer nunca elige una
// ruta arbitraria para leer o escribir.
import { z } from 'zod';
import type { Project } from '@core/model/types';

import type { MenuAction } from './channels';
export { CH, MENU_ACTIONS, type MenuAction } from './channels';

export const projectIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const recentPathSchema = z.string().min(1).max(4096);

export const windowStateSchema = z.object({
  projectId: projectIdSchema.nullable(),
  projectName: z.string().max(200).nullable(),
  dirty: z.boolean(),
});
export type WindowState = z.infer<typeof windowStateSchema>;

export type OpenResult =
  | {
      status: 'ok';
      project: Project;
      filePath: string | null;
      migrated: boolean;
      fromRecovery: boolean;
      /** Nombres de medios que faltan (el proyecto se abre igualmente). */
      missingMedia?: string[];
    }
  | { status: 'canceled' }
  | { status: 'error'; message: string; details?: string[] };

export type SaveResult =
  { status: 'ok'; filePath: string; savedAt: string } | { status: 'canceled' } | { status: 'error'; message: string };

export interface RecentEntry {
  filePath: string;
  name: string;
  openedAt: string;
  exists: boolean;
}

export interface RecoveryEntry {
  projectId: string;
  name: string;
  savedAt: string;
  filePath: string | null;
}

export type MediaImportResult =
  | { status: 'ok'; hash: string; mime: string; name: string; size: number; url: string }
  | { status: 'canceled' }
  | { status: 'error'; message: string };

export type ExportBeginResult =
  { status: 'ok'; id: string; fileName: string } | { status: 'canceled' } | { status: 'error'; message: string };

export type ExportFinishResult = { status: 'ok'; fileName: string } | { status: 'error'; message: string };

export interface AppInfo {
  version: string;
  platform: string;
}

/** API expuesta en `window.dw` por el preload. */
export interface DwApi {
  appInfo(): Promise<AppInfo>;
  /** Sin argumento muestra el diálogo de abrir. Con ruta, solo se acepta si está en recientes. */
  openProject(recentPath?: string): Promise<OpenResult>;
  /** Guarda en la ruta conocida del proyecto o pregunta dónde (siempre si `saveAs`). */
  saveProject(project: Project, saveAs: boolean): Promise<SaveResult>;
  listRecent(): Promise<RecentEntry[]>;
  removeRecent(filePath: string): Promise<void>;
  writeRecovery(project: Project): Promise<void>;
  listRecovery(): Promise<RecoveryEntry[]>;
  restoreRecovery(projectId: string): Promise<OpenResult>;
  discardRecovery(projectId: string): Promise<void>;
  /** Importa una imagen o un audio con el diálogo nativo y lo copia a la caché de medios. */
  importMedia(kind: 'image' | 'audio'): Promise<MediaImportResult>;
  /**
   * Guarda un medio que ya tiene el renderer (una grabación o un archivo soltado en la ventana).
   * El proceso principal decide el tipo por el contenido; `name` solo es informativo.
   */
  importMediaBytes(kind: 'image' | 'audio', name: string, bytes: Uint8Array): Promise<MediaImportResult>;
  /** Pide el destino del vídeo con el diálogo nativo y abre un temporal. Devuelve un id opaco. */
  exportBegin(): Promise<ExportBeginResult>;
  /** Escribe un trozo del vídeo en la posición dada del temporal. */
  exportWrite(id: string, position: number, data: Uint8Array): Promise<void>;
  /** Cierra el temporal y lo convierte en el vídeo final. */
  exportFinish(id: string): Promise<ExportFinishResult>;
  /** Cancela la exportación y borra el temporal. */
  exportCancel(id: string): Promise<void>;
  /** Muestra en la carpeta el último vídeo exportado. */
  exportReveal(): Promise<void>;
  /** Proyecto que el sistema pidió abrir (doble clic en un .dwings), ya añadido a recientes. */
  takePendingOpen(): Promise<string | null>;
  /** Avisa cuando el sistema pide abrir un proyecto con la app ya abierta. */
  onOpenRequest(cb: () => void): () => void;
  setWindowState(state: WindowState): void;
  confirmClose(): void;
  onMenuAction(cb: (action: MenuAction) => void): () => void;
  onRequestSaveAndClose(cb: () => void): () => void;
}

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
  | { status: 'ok'; project: Project; filePath: string | null; migrated: boolean; fromRecovery: boolean }
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
  setWindowState(state: WindowState): void;
  confirmClose(): void;
  onMenuAction(cb: (action: MenuAction) => void): () => void;
  onRequestSaveAndClose(cb: () => void): () => void;
}

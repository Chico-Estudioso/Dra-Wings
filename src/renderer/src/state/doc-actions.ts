// Operaciones de documento que hablan con el proceso principal.
import { pruneAssets } from '@core/audio/clips';
import { createProject, type NewProjectOptions } from '@core/model/factory';
import { buildExampleProject } from '@core/library/example';
import { measureText } from '@core/render/draw';
import { fontsReady } from '../editor/fonts';
import type { OpenResult } from '@shared/ipc';
import { useApp } from './app-store';

const state = () => useApp.getState();

function handleOpenResult(r: OpenResult): boolean {
  if (r.status === 'canceled') return false;
  if (r.status === 'error') {
    state().notify({ kind: 'error', text: r.message, details: r.details });
    return false;
  }
  state().openDoc(r.project, r.filePath, { dirty: r.fromRecovery });
  if (r.migrated)
    state().notify({
      kind: 'info',
      text: 'El proyecto se ha actualizado al formato actual. Se guardará en el nuevo formato.',
    });
  if (r.missingMedia?.length)
    state().notify({
      kind: 'error',
      text: `Faltan ${r.missingMedia.length === 1 ? 'un medio' : `${r.missingMedia.length} medios`} del proyecto: ${r.missingMedia.slice(0, 3).join(', ')}. Se muestran como marcadores; vuelve a importarlos.`,
    });
  if (r.fromRecovery)
    state().notify({
      kind: 'info',
      text: 'Se ha restaurado el trabajo sin guardar. Guarda el proyecto para conservarlo.',
    });
  return true;
}

export async function saveCurrent(saveAs = false): Promise<boolean> {
  const doc = state().doc;
  if (!doc) return false;
  const snapshot = doc.project;
  state().setSaveStatus('saving');
  // Los medios que ya no usa ningún elemento ni clip no se escriben en el archivo (siguen en la
  // caché local, así que deshacer después de guardar no pierde nada).
  const r = await window.dw.saveProject(pruneAssets(snapshot), saveAs);
  if (r.status === 'ok') {
    state().markSaved(r.filePath, r.savedAt, snapshot);
    return true;
  }
  state().setSaveStatus(r.status === 'canceled' ? (doc.dirty ? 'unsaved' : 'saved') : 'error');
  if (r.status === 'error') state().notify({ kind: 'error', text: r.message });
  return false;
}

export function newProject(opts: NewProjectOptions): void {
  state().openDoc(createProject(opts), null, { dirty: true });
}

/** Abre el proyecto de ejemplo (nuevo, sin guardar). Los textos se miden con las fuentes reales. */
export async function openExample(): Promise<void> {
  await fontsReady();
  const ctx = document.createElement('canvas').getContext('2d')!;
  const project = buildExampleProject((text, font, size, lineHeight) => measureText(ctx, text, font, size, lineHeight));
  state().openDoc(project, null, { dirty: true });
}

export async function openWithDialog(): Promise<boolean> {
  return handleOpenResult(await window.dw.openProject());
}

export async function openRecent(filePath: string): Promise<boolean> {
  return handleOpenResult(await window.dw.openProject(filePath));
}

export async function restoreRecovery(projectId: string): Promise<boolean> {
  return handleOpenResult(await window.dw.restoreRecovery(projectId));
}

/** Descarta el documento actual (y su copia de recuperación). */
export async function discardCurrent(): Promise<void> {
  const doc = state().doc;
  if (doc?.dirty) await window.dw.discardRecovery(doc.project.id);
  state().closeDoc();
}

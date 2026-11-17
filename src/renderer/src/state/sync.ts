// Efectos globales: autoguardado en recuperación y estado de la ventana.
import { useApp } from './app-store';

export const AUTOSAVE_DELAY_MS = 3000;

export function startSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSentProject: unknown = null;

  const unsubscribe = useApp.subscribe((s, prev) => {
    const doc = s.doc;
    const prevDoc = prev.doc;
    if (doc?.project !== prevDoc?.project || doc?.dirty !== prevDoc?.dirty) {
      window.dw.setWindowState({
        projectId: doc?.project.id ?? null,
        projectName: doc?.project.name ?? null,
        dirty: doc?.dirty ?? false,
      });
    }
    if (doc?.dirty && doc.project !== lastSentProject) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const current = useApp.getState().doc;
        if (!current?.dirty) return;
        lastSentProject = current.project;
        void window.dw.writeRecovery(current.project);
      }, AUTOSAVE_DELAY_MS);
    }
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

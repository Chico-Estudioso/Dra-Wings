import { useEffect } from 'react';
import { useApp } from './state/app-store';
import { openRecent, openWithDialog, saveCurrent } from './state/doc-actions';
import { requestLeave } from './state/leave-guard';
import { startSync } from './state/sync';
import { Home } from './screens/Home';
import { Editor } from './screens/Editor';
import { NewProjectDialog } from './components/NewProjectDialog';
import { LeaveDialog } from './components/LeaveDialog';
import { NoticeBar } from './components/NoticeBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { openExportDialog } from './export/ExportDialog';
import { saveFrameImage } from './export/frame-image';
import { useEditor } from './editor/editor-store';
import { defaultExportSettings } from '@core/export/plan';

export function App() {
  const screen = useApp((s) => s.screen);

  useEffect(() => startSync(), []);

  // Archivos soltados fuera del lienzo o de la línea de tiempo: se rechazan (cursor de «no se puede»)
  // en lugar de dejar que Chromium intente abrirlos.
  useEffect(() => {
    const reject = (e: DragEvent) => {
      if (e.defaultPrevented || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', reject);
    window.addEventListener('drop', reject);
    return () => {
      window.removeEventListener('dragover', reject);
      window.removeEventListener('drop', reject);
    };
  }, []);

  useEffect(() => {
    const offMenu = window.dw.onMenuAction((action) => {
      const app = useApp.getState();
      switch (action) {
        case 'new':
          requestLeave(() => app.setNewProjectOpen(true));
          break;
        case 'open':
          requestLeave(() => void openWithDialog());
          break;
        case 'save':
          if (app.doc) void saveCurrent(false);
          break;
        case 'saveAs':
          if (app.doc) void saveCurrent(true);
          break;
        case 'export':
          if (app.doc) openExportDialog();
          break;
        case 'exportFrame': {
          if (!app.doc) break;
          const project = app.doc.project;
          const { sceneId, playhead } = useEditor.getState();
          void saveFrameImage(project, sceneId, playhead, defaultExportSettings(project).resolution).then((r) => {
            if (r.status === 'ok')
              app.notify({
                kind: 'info',
                text: `Imagen guardada: ${r.fileName}`,
                action: { label: 'Mostrar en la carpeta', run: () => void window.dw.exportReveal() },
              });
            else if (r.status === 'error') app.notify({ kind: 'error', text: r.message });
          });
          break;
        }
        case 'home':
          requestLeave(() => app.closeDoc());
          break;
        case 'about':
          void window.dw.appInfo().then((i) => app.notify({ kind: 'info', text: `Dra-Wings ${i.version}` }));
          break;
      }
    });
    // Proyecto abierto desde el sistema (doble clic en un .dwings).
    const openPending = () => void window.dw.takePendingOpen().then((p) => p && requestLeave(() => void openRecent(p)));
    openPending();
    const offOpen = window.dw.onOpenRequest(openPending);
    const offClose = window.dw.onRequestSaveAndClose(async () => {
      if (await saveCurrent(false)) window.dw.confirmClose();
    });
    return () => {
      offMenu();
      offOpen();
      offClose();
    };
  }, []);

  return (
    <>
      <ErrorBoundary key={screen}>{screen === 'home' ? <Home /> : <Editor />}</ErrorBoundary>
      <NewProjectDialog />
      <LeaveDialog />
      <NoticeBar />
    </>
  );
}

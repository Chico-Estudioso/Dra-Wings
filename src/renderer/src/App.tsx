import { useEffect } from 'react';
import { useApp } from './state/app-store';
import { openWithDialog, saveCurrent } from './state/doc-actions';
import { requestLeave } from './state/leave-guard';
import { startSync } from './state/sync';
import { Home } from './screens/Home';
import { Editor } from './screens/Editor';
import { NewProjectDialog } from './components/NewProjectDialog';
import { LeaveDialog } from './components/LeaveDialog';
import { NoticeBar } from './components/NoticeBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { openExportDialog } from './export/ExportDialog';

export function App() {
  const screen = useApp((s) => s.screen);

  useEffect(() => startSync(), []);

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
        case 'home':
          requestLeave(() => app.closeDoc());
          break;
        case 'about':
          void window.dw.appInfo().then((i) => app.notify({ kind: 'info', text: `Dra-Wings ${i.version}` }));
          break;
      }
    });
    const offClose = window.dw.onRequestSaveAndClose(async () => {
      if (await saveCurrent(false)) window.dw.confirmClose();
    });
    return () => {
      offMenu();
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

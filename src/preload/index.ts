// API mínima y explícita expuesta al renderer como `window.dw`. No expone Node ni ipcRenderer.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CH, type MenuAction } from '@shared/channels';
import type { DwApi } from '@shared/ipc';

const api: DwApi = {
  appInfo: () => ipcRenderer.invoke(CH.appInfo),
  openProject: (recentPath) => ipcRenderer.invoke(CH.projectOpen, recentPath),
  saveProject: (project, saveAs) => ipcRenderer.invoke(CH.projectSave, project, saveAs),
  listRecent: () => ipcRenderer.invoke(CH.recentList),
  removeRecent: (filePath) => ipcRenderer.invoke(CH.recentRemove, filePath),
  writeRecovery: (project) => ipcRenderer.invoke(CH.recoveryWrite, project),
  listRecovery: () => ipcRenderer.invoke(CH.recoveryList),
  restoreRecovery: (projectId) => ipcRenderer.invoke(CH.recoveryRestore, projectId),
  discardRecovery: (projectId) => ipcRenderer.invoke(CH.recoveryDiscard, projectId),
  importMedia: (kind) => ipcRenderer.invoke(CH.mediaImport, kind),
  setWindowState: (state) => ipcRenderer.send(CH.windowState, state),
  confirmClose: () => ipcRenderer.send(CH.closeConfirmed),
  onMenuAction: (cb) => {
    const listener = (_e: IpcRendererEvent, action: MenuAction) => cb(action);
    ipcRenderer.on(CH.menuAction, listener);
    return () => ipcRenderer.removeListener(CH.menuAction, listener);
  },
  onRequestSaveAndClose: (cb) => {
    const listener = () => cb();
    ipcRenderer.on(CH.requestSaveAndClose, listener);
    return () => ipcRenderer.removeListener(CH.requestSaveAndClose, listener);
  },
};

contextBridge.exposeInMainWorld('dw', api);

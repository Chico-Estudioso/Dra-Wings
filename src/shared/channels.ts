// Nombres de canal IPC. Sin dependencias para que el preload sea mínimo.
export const CH = {
  appInfo: 'app:info',
  projectOpen: 'project:open',
  projectSave: 'project:save',
  recentList: 'recent:list',
  recentRemove: 'recent:remove',
  recoveryWrite: 'recovery:write',
  recoveryList: 'recovery:list',
  recoveryRestore: 'recovery:restore',
  recoveryDiscard: 'recovery:discard',
  windowState: 'window:state',
  closeConfirmed: 'window:close-confirmed',
  menuAction: 'menu:action',
  requestSaveAndClose: 'window:request-save-and-close',
  mediaImport: 'media:import',
} as const;

export const MENU_ACTIONS = ['new', 'open', 'save', 'saveAs', 'home', 'about'] as const;
export type MenuAction = (typeof MENU_ACTIONS)[number];

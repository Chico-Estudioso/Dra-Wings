import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, protocol, session, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectSchema } from '@core/model/schema';
import { formatIssues } from '@core/model/validate';
import {
  CH,
  projectIdSchema,
  recentPathSchema,
  windowStateSchema,
  type MenuAction,
  type MediaImportResult,
  type OpenResult,
  type SaveResult,
  type WindowState,
} from '@shared/ipc';
import { PROJECT_EXTENSION, ProjectFileError, readProjectFile, writeProjectFile } from './project-file';
import { RecoveryStore } from './recovery';
import { RecentStore } from './recent';
import { MEDIA_NAME, MediaError, MediaStore } from './media';
import { APP_ORIGIN, MEDIA_EXT_BY_MIME } from '@shared/media';

// Permite aislar los datos en pruebas E2E.
if (process.env.DW_USER_DATA) app.setPath('userData', process.env.DW_USER_DATA);

const APP_HOST = new URL(APP_ORIGIN).host;
const DEV_URL = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
const RENDERER_ROOT = path.join(__dirname, '../renderer');
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const recovery = new RecoveryStore(path.join(app.getPath('userData'), 'recovery'));
const recent = new RecentStore(path.join(app.getPath('userData'), 'recent.json'));
const media = new MediaStore(path.join(app.getPath('userData'), 'media-cache'));
const fileFilters = [{ name: 'Proyectos de Dra-Wings', extensions: [PROJECT_EXTENSION] }];

let mainWindow: BrowserWindow | null = null;
/** Documento abierto según el proceso principal: la ruta solo la decide él. */
let doc: { projectId: string | null; filePath: string | null } = { projectId: null, filePath: null };
let windowState: WindowState = { projectId: null, projectName: null, dirty: false };
let closeConfirmed = false;

function log(...args: unknown[]) {
  if (!app.isPackaged) console.log('[main]', ...args);
}

function isAllowedUrl(url: string): boolean {
  return url.startsWith(`${APP_ORIGIN}/`) || (!!DEV_URL && url.startsWith(DEV_URL));
}

function sanitizeFileName(name: string): string {
  const clean = name
    // eslint-disable-next-line no-control-regex -- los caracteres de control no son válidos en nombres de archivo
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 100);
  return clean || 'Proyecto';
}

function updateTitle() {
  if (!mainWindow) return;
  const { projectName, dirty } = windowState;
  mainWindow.setTitle(projectName ? `${projectName}${dirty ? ' •' : ''} — Dra-Wings` : 'Dra-Wings');
  mainWindow.setDocumentEdited(dirty);
}

function sendMenu(action: MenuAction) {
  mainWindow?.webContents.send(CH.menuAction, action);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nuevo proyecto…', accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new') },
        { label: 'Abrir…', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open') },
        { type: 'separator' },
        { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save') },
        { label: 'Guardar como…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenu('saveAs') },
        { type: 'separator' },
        { label: 'Ir a inicio', click: () => sendMenu('home') },
        ...(isMac ? [] : [{ type: 'separator' as const }, { label: 'Salir', role: 'quit' as const }]),
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', role: 'undo' },
        { label: 'Rehacer', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Pegar', role: 'paste' },
        { label: 'Seleccionar todo', role: 'selectAll' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Pantalla completa', role: 'togglefullscreen' },
        ...(app.isPackaged
          ? []
          : [
              { type: 'separator' as const },
              { label: 'Recargar', role: 'reload' as const },
              { label: 'Herramientas de desarrollo', role: 'toggleDevTools' as const },
            ]),
      ],
    },
    { label: 'Ayuda', submenu: [{ label: 'Acerca de Dra-Wings', click: () => sendMenu('about') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  closeConfirmed = false;
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Dra-Wings',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1b19' : '#f6f4ef',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  mainWindow = win;
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.on('close', (e) => {
    if (closeConfirmed || !windowState.dirty) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Guardar', 'No guardar', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Cambios sin guardar',
      message: `¿Quieres guardar los cambios de «${windowState.projectName ?? 'Proyecto'}»?`,
      detail: 'Si no los guardas, se perderán los cambios hechos desde el último guardado.',
    });
    if (choice === 0) win.webContents.send(CH.requestSaveAndClose);
    else if (choice === 1) {
      if (windowState.projectId) void recovery.discard(windowState.projectId);
      closeConfirmed = true;
      win.close();
    }
  });
  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadURL(`${APP_ORIGIN}/index.html`);
}

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(MEDIA_EXT_BY_MIME).map(([mime, ext]) => [ext, mime]),
);
const mimeOf = (name: string) => MIME_BY_EXT[name.split('.').pop() ?? ''] ?? 'application/octet-stream';

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return new Response('No encontrado', { status: 404 });
    if (url.pathname.startsWith('/media/')) {
      // Medios del proyecto: solo nombres `<sha256>.<ext>` de la caché.
      const name = url.pathname.slice(7);
      if (!MEDIA_NAME.test(name)) return new Response('No permitido', { status: 403 });
      try {
        const bytes = await media.read(name);
        const headers = new Headers({ 'Content-Type': mimeOf(name), 'Cache-Control': 'max-age=31536000, immutable' });
        if (DEV_URL) headers.set('Access-Control-Allow-Origin', new URL(DEV_URL).origin);
        return new Response(Buffer.from(bytes), { status: 200, headers });
      } catch {
        return new Response('No encontrado', { status: 404 });
      }
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const full = path.normalize(path.join(RENDERER_ROOT, rel));
    if (!full.startsWith(RENDERER_ROOT + path.sep)) return new Response('No permitido', { status: 403 });
    const res = await net.fetch(pathToFileURL(full).toString());
    const headers = new Headers(res.headers);
    headers.set('Content-Security-Policy', CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(res.body, { status: res.status, headers });
  });
}

function errorResult(e: unknown, fallback: string): { status: 'error'; message: string; details?: string[] } {
  if (e instanceof ProjectFileError) return { status: 'error', message: e.message, details: e.details };
  log(e);
  return { status: 'error', message: fallback };
}

function registerIpc() {
  ipcMain.handle(CH.appInfo, () => ({ version: app.getVersion(), platform: process.platform }));

  ipcMain.handle(CH.projectOpen, async (_e, recentPath?: unknown): Promise<OpenResult> => {
    let filePath: string;
    if (recentPath !== undefined) {
      const p = recentPathSchema.safeParse(recentPath);
      if (!p.success || !(await recent.has(p.data)))
        return { status: 'error', message: 'Ese proyecto no está en la lista de recientes.' };
      filePath = p.data;
    } else {
      const r = await dialog.showOpenDialog(mainWindow!, {
        title: 'Abrir proyecto',
        properties: ['openFile'],
        filters: fileFilters,
      });
      if (r.canceled || !r.filePaths[0]) return { status: 'canceled' };
      filePath = r.filePaths[0];
    }
    try {
      const { project, migrated, missingMedia } = await readProjectFile(filePath, media);
      doc = { projectId: project.id, filePath };
      await recent.touch(filePath, project.name);
      return { status: 'ok', project, filePath, migrated, fromRecovery: false, missingMedia };
    } catch (e) {
      return errorResult(e, 'No se pudo abrir el proyecto.');
    }
  });

  ipcMain.handle(CH.projectSave, async (_e, rawProject: unknown, saveAs: unknown): Promise<SaveResult> => {
    const parsed = projectSchema.safeParse(rawProject);
    if (!parsed.success)
      return { status: 'error', message: `Datos del proyecto no válidos: ${formatIssues(parsed.error, 1)[0]}` };
    const savedAt = new Date().toISOString();
    const project = { ...parsed.data, updatedAt: savedAt };
    let target = saveAs !== true && doc.projectId === project.id ? doc.filePath : null;
    if (!target) {
      const folder = path.join(app.getPath('documents'), 'Dra-Wings');
      await mkdir(folder, { recursive: true }).catch(() => {});
      const r = await dialog.showSaveDialog(mainWindow!, {
        title: saveAs === true ? 'Guardar como' : 'Guardar proyecto',
        defaultPath: path.join(folder, `${sanitizeFileName(project.name)}.${PROJECT_EXTENSION}`),
        filters: fileFilters,
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      });
      if (r.canceled || !r.filePath) return { status: 'canceled' };
      target = r.filePath.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`)
        ? r.filePath
        : `${r.filePath}.${PROJECT_EXTENSION}`;
    }
    try {
      await writeProjectFile(target, project, app.getVersion(), media);
      doc = { projectId: project.id, filePath: target };
      await recent.touch(target, project.name);
      await recovery.discard(project.id);
      return { status: 'ok', filePath: target, savedAt };
    } catch (e) {
      return errorResult(e, 'No se pudo guardar el proyecto.');
    }
  });

  ipcMain.handle(CH.mediaImport, async (_e, kind: unknown): Promise<MediaImportResult> => {
    if (kind !== 'image' && kind !== 'audio') return { status: 'error', message: 'Tipo de medio no válido.' };
    const filters =
      kind === 'image'
        ? [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
        : [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'aac', 'flac'] }];
    const r = await dialog.showOpenDialog(mainWindow!, {
      title: kind === 'image' ? 'Importar imagen' : 'Importar audio',
      properties: ['openFile'],
      filters,
    });
    if (r.canceled || !r.filePaths[0]) return { status: 'canceled' };
    try {
      const m = await media.import(r.filePaths[0], kind);
      return {
        status: 'ok',
        hash: m.hash,
        mime: m.mime,
        name: m.name,
        size: m.size,
        url: `${APP_ORIGIN}/media/${media.fileName(m.hash, m.mime)}`,
      };
    } catch (e) {
      return { status: 'error', message: e instanceof MediaError ? e.message : 'No se pudo importar el archivo.' };
    }
  });

  ipcMain.handle(CH.recentList, () => recent.list());
  ipcMain.handle(CH.recentRemove, async (_e, filePath: unknown) => {
    const p = recentPathSchema.safeParse(filePath);
    if (p.success) await recent.remove(p.data);
  });

  ipcMain.handle(CH.recoveryWrite, async (_e, rawProject: unknown) => {
    const parsed = projectSchema.safeParse(rawProject);
    if (!parsed.success) return;
    const filePath = doc.projectId === parsed.data.id ? doc.filePath : null;
    await recovery.write(parsed.data, filePath).catch((e) => log('recuperación', e));
  });
  ipcMain.handle(CH.recoveryList, () => recovery.list());
  ipcMain.handle(CH.recoveryDiscard, async (_e, id: unknown) => {
    const p = projectIdSchema.safeParse(id);
    if (p.success) await recovery.discard(p.data);
  });
  ipcMain.handle(CH.recoveryRestore, async (_e, id: unknown): Promise<OpenResult> => {
    const p = projectIdSchema.safeParse(id);
    if (!p.success) return { status: 'error', message: 'Recuperación no válida.' };
    try {
      const r = await recovery.read(p.data);
      const parsed = projectSchema.safeParse(r.project);
      if (!parsed.success)
        return {
          status: 'error',
          message: 'La copia de recuperación está dañada.',
          details: formatIssues(parsed.error),
        };
      doc = { projectId: parsed.data.id, filePath: r.filePath };
      return { status: 'ok', project: parsed.data, filePath: r.filePath, migrated: false, fromRecovery: true };
    } catch (e) {
      return errorResult(e, 'No se pudo leer la copia de recuperación.');
    }
  });

  ipcMain.on(CH.windowState, (_e, raw: unknown) => {
    const s = windowStateSchema.safeParse(raw);
    if (!s.success) return;
    windowState = s.data;
    updateTitle();
  });
  ipcMain.on(CH.closeConfirmed, () => {
    closeConfirmed = true;
    mainWindow?.close();
  });
}

function hardenSessions() {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (e, url) => {
      if (!isAllowedUrl(url)) e.preventDefault();
    });
    contents.on('will-attach-webview', (e) => e.preventDefault());
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  hardenSessions();
  registerIpc();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

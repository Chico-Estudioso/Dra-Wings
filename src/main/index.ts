import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, protocol, session, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { mkdir, stat, writeFile } from 'node:fs/promises';
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
  type ExportBeginResult,
  type ExportFinishResult,
  type MediaImportResult,
  type OpenResult,
  type SaveResult,
  type WindowState,
} from '@shared/ipc';
import { PROJECT_EXTENSION, ProjectFileError, readProjectFile, writeProjectFile } from './project-file';
import { RecoveryStore } from './recovery';
import { RecentStore } from './recent';
import { MEDIA_NAME, MediaError, MediaStore } from './media';
import { ExportError, ExportSessions } from './export';
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
const exports = new ExportSessions();
let lastExport: string | null = null;
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
        { label: 'Exportar vídeo…', accelerator: 'CmdOrCtrl+E', click: () => sendMenu('export') },
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
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Acerca de Dra-Wings', click: () => sendMenu('about') },
        ...(app.isPackaged
          ? [
              {
                label: 'Licencias de terceros',
                click: () =>
                  void shell.openPath(path.join(process.resourcesPath, 'licenses', 'THIRD_PARTY_LICENSES.txt')),
              },
            ]
          : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Abrir un .dwings desde el sistema (doble clic o «Abrir con»): la ruta llega por la línea de
// órdenes. Se añade a recientes y el renderer la abre por la vía normal (que solo acepta recientes).
let pendingOpen: string | null = null;

function projectArg(argv: string[], cwd = process.cwd()): string | null {
  const arg = argv.slice(1).find((a) => !a.startsWith('-') && a.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`));
  return arg ? path.resolve(cwd, arg) : null;
}

async function queueSystemOpen(filePath: string): Promise<void> {
  try {
    if (!(await stat(filePath)).isFile()) return;
  } catch {
    return;
  }
  await recent.touch(filePath, path.basename(filePath, `.${PROJECT_EXTENSION}`));
  pendingOpen = filePath;
  mainWindow?.webContents.send(CH.openRequest);
}

/** Comprobación de arranque de la app empaquetada (CI): ¿carga la interfaz con su API? */
function runSmokeTest(win: BrowserWindow) {
  win.webContents.once('did-finish-load', () => {
    void win.webContents
      .executeJavaScript(
        `new Promise((r) => setTimeout(() => r({ ui: !!document.querySelector('.home'), api: typeof window.dw?.appInfo === 'function' }), 1500))`,
      )
      .then(async (result: { ui: boolean; api: boolean }) => {
        const ok = result.ui && result.api;
        await writeFile(
          path.join(app.getPath('userData'), 'smoke.json'),
          JSON.stringify({ ok, ...result, version: app.getVersion() }),
        );
        app.exit(ok ? 0 : 1);
      });
  });
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
  if (process.env.DW_SMOKE_TEST) runSmokeTest(win);
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
    void exports.cancel(); // una exportación a medias no deja temporales
  });
  // Si el proceso de la interfaz se cae, se recarga. El trabajo sin guardar está en la copia de
  // recuperación (autoguardado cada pocos segundos) y la pantalla de inicio la ofrece.
  win.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return;
    log('renderer caído:', details.reason);
    void exports.cancel();
    doc = { projectId: null, filePath: null };
    windowState = { projectId: null, projectName: null, dirty: false };
    updateTitle();
    void dialog
      .showMessageBox(win, {
        type: 'error',
        title: 'Dra-Wings',
        message: 'La ventana se ha cerrado por un error y se va a recargar.',
        detail: 'Si tenías cambios sin guardar, podrás recuperarlos desde la pantalla de inicio.',
        buttons: ['Recargar'],
        noLink: true,
      })
      .then(() => !win.isDestroyed() && win.webContents.reload());
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

  ipcMain.handle(
    CH.mediaImportBytes,
    async (_e, kind: unknown, name: unknown, bytes: unknown): Promise<MediaImportResult> => {
      if ((kind !== 'image' && kind !== 'audio') || typeof name !== 'string' || !(bytes instanceof Uint8Array))
        return { status: 'error', message: 'Datos de medio no válidos.' };
      try {
        const m = await media.importBytes(bytes, kind, name);
        return {
          status: 'ok',
          hash: m.hash,
          mime: m.mime,
          name: m.name,
          size: m.size,
          url: `${APP_ORIGIN}/media/${media.fileName(m.hash, m.mime)}`,
        };
      } catch (e) {
        return { status: 'error', message: e instanceof MediaError ? e.message : 'No se pudo guardar el medio.' };
      }
    },
  );

  ipcMain.handle(CH.exportBegin, async (): Promise<ExportBeginResult> => {
    if (exports.active) return { status: 'error', message: 'Ya hay una exportación en curso.' };
    const folder = app.getPath('videos');
    const r = await dialog.showSaveDialog(mainWindow!, {
      title: 'Exportar vídeo',
      defaultPath: path.join(folder, `${sanitizeFileName(windowState.projectName ?? 'Vídeo')}.mp4`),
      filters: [{ name: 'Vídeo MP4', extensions: ['mp4'] }],
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    });
    if (r.canceled || !r.filePath) return { status: 'canceled' };
    const target = r.filePath.toLowerCase().endsWith('.mp4') ? r.filePath : `${r.filePath}.mp4`;
    try {
      const id = await exports.begin(target);
      return { status: 'ok', id, fileName: path.basename(target) };
    } catch (e) {
      log(e);
      return {
        status: 'error',
        message: e instanceof ExportError ? e.message : 'No se puede escribir en esa carpeta. Elige otra ubicación.',
      };
    }
  });
  ipcMain.handle(CH.exportWrite, (_e, id: unknown, position: unknown, data: unknown) =>
    exports.write(id, position, data),
  );
  ipcMain.handle(CH.exportFinish, async (_e, id: unknown): Promise<ExportFinishResult> => {
    try {
      lastExport = await exports.finish(id);
      return { status: 'ok', fileName: path.basename(lastExport) };
    } catch (e) {
      log(e);
      const code = (e as NodeJS.ErrnoException).code;
      return {
        status: 'error',
        message:
          code === 'ENOSPC'
            ? 'No se pudo terminar el vídeo: el disco está lleno.'
            : 'No se pudo terminar el vídeo. Si el archivo de destino está abierto en otro programa, ciérralo y vuelve a exportar.',
      };
    }
  });
  ipcMain.handle(CH.exportCancel, (_e, id: unknown) => exports.cancel(id));
  ipcMain.handle(CH.exportReveal, () => {
    if (lastExport) shell.showItemInFolder(lastExport);
  });

  ipcMain.handle(CH.takePendingOpen, () => {
    const p = pendingOpen;
    pendingOpen = null;
    return p;
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

/** ¿La petición viene de la propia interfaz (app:// o, en desarrollo, el servidor de Vite)? */
function isOwnOrigin(url: string | undefined): boolean {
  return (
    !!url &&
    (url.startsWith(`${APP_ORIGIN}/`) || url === APP_ORIGIN || (!!DEV_URL && url.startsWith(new URL(DEV_URL).origin)))
  );
}

function hardenSessions() {
  // Todo denegado salvo el micrófono (nunca la cámara) para grabar la narración desde la propia app.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) => {
    const media = details as Electron.MediaAccessPermissionRequest;
    cb(
      permission === 'media' &&
        isOwnOrigin(media.securityOrigin ?? media.requestingUrl) &&
        (media.mediaTypes ?? []).length > 0 &&
        (media.mediaTypes ?? []).every((t) => t === 'audio'),
    );
  });
  session.defaultSession.setPermissionCheckHandler(
    (_wc, permission, origin, details) =>
      permission === 'media' && details.mediaType === 'audio' && isOwnOrigin(origin),
  );
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

if (!app.requestSingleInstanceLock()) {
  // Ya hay una ventana abierta: ella recibe la petición (second-instance) y esta instancia termina.
  app.quit();
} else {
  app.on('second-instance', (_e, argv, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const file = projectArg(argv, workingDirectory);
    if (file) void queueSystemOpen(file);
  });

  app.whenReady().then(async () => {
    registerAppProtocol();
    hardenSessions();
    registerIpc();
    buildMenu();
    const file = projectArg(process.argv);
    if (file) await queueSystemOpen(file);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

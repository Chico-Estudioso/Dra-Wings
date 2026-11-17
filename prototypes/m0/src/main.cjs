// Proceso principal del prototipo M0. Configuración segura: contextIsolation, sandbox, sin nodeIntegration
// e IPC con argumentos validados. No forma parte de la aplicación final.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn, spawnSync } = require('node:child_process');

const outDir = path.resolve(process.env.PROTO_OUT || path.join(__dirname, '..', 'out'));
const SAFE_NAME = /^[a-z0-9][a-z0-9._-]{0,80}$/i;

function safeOutPath(name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) throw new Error('Nombre de archivo no válido');
  return path.join(outDir, name);
}

function detectFfmpeg() {
  const bin = process.env.FFMPEG_PATH || 'ffmpeg';
  const r = spawnSync(bin, ['-hide_banner', '-version'], { encoding: 'utf8' });
  if (r.status !== 0) return { available: false };
  return { available: true, bin, version: r.stdout.split('\n')[0] };
}

const ffmpegInfo = detectFfmpeg();
let ffmpeg = null;

ipcMain.handle('proto:config', () => ({
  platform: process.platform,
  arch: process.arch,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
  ffmpeg: { available: ffmpegInfo.available, version: ffmpegInfo.version ?? null },
}));

ipcMain.handle('proto:write-output', async (_e, name, bytes) => {
  if (!(bytes instanceof Uint8Array)) throw new Error('Datos no válidos');
  const p = safeOutPath(name);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(p, bytes);
  return p;
});

ipcMain.handle('proto:read-output', async (_e, name) => new Uint8Array(await fs.readFile(safeOutPath(name))));

ipcMain.handle('proto:ffmpeg-start', async (_e, opts) => {
  if (!ffmpegInfo.available) throw new Error('ffmpeg no disponible');
  if (ffmpeg) throw new Error('ffmpeg ya está en marcha');
  const { width, height, fps } = opts ?? {};
  for (const n of [width, height, fps]) if (!Number.isInteger(n) || n <= 0 || n > 8192) throw new Error('Parámetros no válidos');
  const audio = safeOutPath(opts.audio);
  const output = safeOutPath(opts.output);
  // Argumentos como lista (sin shell) y rutas controladas por el proceso principal.
  const args = [
    '-hide_banner', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0',
    '-i', audio,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', output,
  ];
  const proc = spawn(ffmpegInfo.bin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
  const exited = new Promise((resolve) => proc.on('close', (code) => resolve(code)));
  ffmpeg = { proc, exited, getStderr: () => stderr, t0: Date.now() };
  return true;
});

ipcMain.handle('proto:ffmpeg-frame', async (_e, bytes) => {
  if (!ffmpeg || !(bytes instanceof Uint8Array)) throw new Error('Estado no válido');
  if (!ffmpeg.proc.stdin.write(bytes)) await new Promise((r) => ffmpeg.proc.stdin.once('drain', r));
  return true;
});

ipcMain.handle('proto:ffmpeg-end', async () => {
  if (!ffmpeg) throw new Error('ffmpeg no está en marcha');
  ffmpeg.proc.stdin.end();
  const code = await ffmpeg.exited;
  const r = { code, encodeMs: Date.now() - ffmpeg.t0, stderrTail: ffmpeg.getStderr().split('\n').slice(-6).join('\n') };
  ffmpeg = null;
  return r;
});

ipcMain.on('proto:log', (_e, m) => console.log(String(m)));
ipcMain.on('proto:done', (_e, code) => {
  console.log(`Resultados en ${outDir}`);
  app.exit(Number.isInteger(code) ? code : 3);
});

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 1300,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on('render-process-gone', (_e, d) => {
    console.error('Renderer caído', d);
    app.exit(4);
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  setTimeout(() => {
    console.error('Tiempo agotado');
    app.exit(5);
  }, 10 * 60 * 1000);
});

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface Launched {
  app: ElectronApplication;
  page: Page;
}

export async function tempDir(prefix = 'dw-e2e-'): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

export async function launch(userData: string): Promise<Launched> {
  const args = ['.'];
  // En Linux como root (contenedores) o en CI (AppArmor restringe los namespaces), sin sandbox de Chromium.
  if (process.platform === 'linux' && (process.getuid?.() === 0 || process.env.CI)) args.push('--no-sandbox');
  const env = { ...process.env, DW_USER_DATA: userData } as Record<string, string>;
  delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args, env });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Nuevo proyecto' }).waitFor();
  return { app, page };
}

export async function stubSaveDialog(app: ElectronApplication, filePath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as typeof dialog.showSaveDialog;
  }, filePath);
}

export async function stubOpenDialog(app: ElectronApplication, filePath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as typeof dialog.showOpenDialog;
  }, filePath);
}

export async function stubMessageBox(app: ElectronApplication, buttonIndex: number) {
  await app.evaluate(({ dialog }, i) => {
    dialog.showMessageBoxSync = (() => i) as typeof dialog.showMessageBoxSync;
  }, buttonIndex);
}

export async function createProject(page: Page, name: string) {
  await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
  const input = page.getByLabel('Nombre', { exact: true });
  await input.fill(name);
  await page.getByRole('button', { name: 'Crear proyecto' }).click();
  await page.getByLabel('Nombre del proyecto').waitFor();
}

/** Simula un cierre inesperado. En Windows hay que matar el árbol entero o quedan procesos huérfanos. */
export async function killHard(app: ElectronApplication) {
  const proc = app.process();
  const closed = app.waitForEvent('close').catch(() => {});
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
  else proc.kill('SIGKILL');
  await closed;
}

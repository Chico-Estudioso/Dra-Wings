/// <reference lib="dom" />
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import type { Project } from '../../src/core/model/types';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface Launched {
  app: ElectronApplication;
  page: Page;
}

export async function tempDir(prefix = 'dw-e2e-'): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

export async function launch(userData: string, extraArgs: string[] = []): Promise<Launched> {
  const args = ['.', ...extraArgs];
  // En Linux como root (contenedores) o en CI (AppArmor restringe los namespaces), sin sandbox de Chromium.
  if (process.platform === 'linux' && (process.getuid?.() === 0 || process.env.CI)) args.push('--no-sandbox');
  const env = { ...process.env, DW_USER_DATA: userData } as Record<string, string>;
  delete env.ELECTRON_RENDERER_URL;
  const app = await electron.launch({ args, env });
  const page = await app.firstWindow();
  // Mismo tamaño en todas las plataformas (los runners de Windows tienen pantallas de 1024×768).
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1024, 700));
  // Inicio o, si se abrió con un proyecto en la línea de órdenes, directamente el editor.
  await page.getByRole('button', { name: 'Nuevo proyecto' }).or(page.getByTestId('overlay-canvas')).waitFor();
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

export async function newFreeProject(page: Page, name = 'Dibujo', mode: 'Guiado' | 'Mixto' | 'Libre' = 'Libre') {
  await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  await page.getByRole('radio', { name: new RegExp(mode) }).click();
  await page.getByRole('button', { name: 'Crear proyecto' }).click();
  await page.getByTestId('overlay-canvas').waitFor();
}

export async function center(page: Page) {
  const b = (await page.getByTestId('overlay-canvas').boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

export const itemCount = async (page: Page) =>
  parseInt((await page.getByTestId('item-count').textContent()) ?? '0', 10);

export async function sceneHash(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"]')!;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 4) h = Math.imul(h ^ (d[i]! + d[i + 1]! * 3 + d[i + 2]! * 7), 16777619);
    return h >>> 0;
  });
}

export async function saveAndRead(
  app: Awaited<ReturnType<typeof launch>>['app'],
  page: Page,
  file: string,
): Promise<Project> {
  await stubSaveDialog(app, file);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Guardado');
  const files = unzipSync(await readFile(file));
  return JSON.parse(strFromU8(files['project.json']!)) as Project;
}

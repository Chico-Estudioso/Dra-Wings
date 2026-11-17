/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import type { Project } from '../../src/core/model/types';
import { launch, stubMessageBox, stubSaveDialog, tempDir } from './helpers';

async function newFreeProject(page: Page, name = 'Dibujo') {
  await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  await page.getByRole('radio', { name: /Libre/ }).click();
  await page.getByRole('button', { name: 'Crear proyecto' }).click();
  await page.getByTestId('overlay-canvas').waitFor();
}

async function center(page: Page) {
  const b = (await page.getByTestId('overlay-canvas').boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

const itemCount = async (page: Page) =>
  (await page.locator('.layer-count').allTextContents()).reduce((s, t) => s + Number(t), 0);

async function sceneHash(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"]')!;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 4) h = Math.imul(h ^ (d[i]! + d[i + 1]! * 3 + d[i + 2]! * 7), 16777619);
    return h >>> 0;
  });
}

async function saveAndRead(app: Awaited<ReturnType<typeof launch>>['app'], page: Page, file: string): Promise<Project> {
  await stubSaveDialog(app, file);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Guardado');
  const files = unzipSync(await readFile(file));
  return JSON.parse(strFromU8(files['project.json']!)) as Project;
}

test('trazos, formas y texto se guardan y se ven igual al reabrir', async () => {
  const userData = await tempDir();
  const file = path.join(await tempDir(), 'dibujo.dwings');
  let { app, page } = await launch(userData);
  await newFreeProject(page);
  const c = await center(page);

  await drag(page, { x: c.x - 200, y: c.y }, { x: c.x - 50, y: c.y - 60 });
  await drag(page, { x: c.x - 200, y: c.y + 40 }, { x: c.x - 50, y: c.y + 80 });
  await page.keyboard.press('r');
  await drag(page, { x: c.x + 40, y: c.y - 40 }, { x: c.x + 160, y: c.y + 40 }, 4);
  await page.keyboard.press('t');
  await page.mouse.click(c.x - 150, c.y + 150);
  await page.keyboard.type('Hola');
  await page.keyboard.press('Escape');
  await expect.poll(() => itemCount(page)).toBe(4);

  const project = await saveAndRead(app, page, file);
  const items = project.scenes[0]!.layers[0]!.items!;
  expect(items.map((i) => i.type)).toEqual(['stroke', 'stroke', 'shape', 'text']);
  expect(items[3]).toMatchObject({ type: 'text', text: 'Hola', font: 'hand' });
  const firstStroke = items[0]!;
  expect(firstStroke.type === 'stroke' && firstStroke.points.length / 4).toBeGreaterThan(5);
  const before = await sceneHash(page);

  await app.close();
  ({ app, page } = await launch(userData));
  await page.getByRole('button', { name: /^Dibujo/ }).click();
  await expect.poll(() => itemCount(page)).toBe(4);
  await expect.poll(() => sceneHash(page)).toBe(before);
  await app.close();
});

test('seleccionar, mover, rotar con mayúsculas y deshacer', async () => {
  const file = path.join(await tempDir(), 'mover.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Mover');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 60, y: c.y - 40 }, { x: c.x + 60, y: c.y + 40 }, 4);
  // Al terminar la forma se activa Seleccionar con la forma seleccionada.
  await expect(page.getByRole('button', { name: 'Seleccionar' })).toHaveAttribute('aria-pressed', 'true');
  const shapeOf = (p: Project) => p.scenes[0]!.layers[0]!.items![0]!;
  const valueOf = (a: unknown) => (a as { value: number }).value;
  const before = shapeOf(await saveAndRead(app, page, file));

  // Mover arrastrando el borde inferior (lejos de los tiradores).
  await drag(page, { x: c.x - 30, y: c.y + 40 }, { x: c.x + 70, y: c.y + 90 });
  const moved = shapeOf(await saveAndRead(app, page, file));
  expect(valueOf(moved.transform.x)).toBeGreaterThan(valueOf(before.transform.x));
  expect(valueOf(moved.transform.y)).toBeGreaterThan(valueOf(before.transform.y));
  expect(moved.transform.scaleX).toEqual({ value: 1 });

  // Rotar con Mayús: el tirador está ~28 px por encima del borde superior, que ahora está en c.y + 10.
  await page.keyboard.down('Shift');
  await drag(page, { x: c.x + 100, y: c.y - 20 }, { x: c.x + 300, y: c.y + 50 });
  await page.keyboard.up('Shift');
  expect(shapeOf(await saveAndRead(app, page, file)).transform.rotation).toEqual({ value: 90 });

  await page.keyboard.press('Control+z');
  expect(shapeOf(await saveAndRead(app, page, file)).transform.rotation).toEqual({ value: 0 });

  await page.keyboard.press('Delete');
  await expect.poll(() => itemCount(page)).toBe(0);
  await stubMessageBox(app, 1);
  await app.close();
});

test('la goma parte un trazo y se puede deshacer', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Goma');
  const c = await center(page);
  await drag(page, { x: c.x - 200, y: c.y }, { x: c.x + 200, y: c.y }, 30);
  await expect.poll(() => itemCount(page)).toBe(1);
  await page.keyboard.press('e');
  await drag(page, { x: c.x, y: c.y - 60 }, { x: c.x, y: c.y + 60 }, 10);
  await expect.poll(() => itemCount(page)).toBe(2);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  await stubMessageBox(app, 1);
  await app.close();
});

test('capas: bloquear impide dibujar, y se dibuja en la capa activa', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Capas');
  const c = await center(page);
  await page.getByRole('button', { name: 'Bloquear Capa 1' }).click();
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await expect(page.getByRole('status').filter({ hasText: 'está bloqueada' })).toBeVisible();
  await expect.poll(() => itemCount(page)).toBe(0);

  await page.getByRole('button', { name: 'Nueva capa' }).click();
  await expect(page.getByRole('option', { name: /Capa 2/ })).toHaveAttribute('aria-selected', 'true');
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await expect(page.locator('.layer-count').first()).toHaveText('1'); // Capa 2 aparece arriba
  await page.getByRole('button', { name: 'Ocultar Capa 2' }).click();
  await expect(page.getByRole('button', { name: 'Mostrar Capa 2' })).toBeVisible();
  await stubMessageBox(app, 1);
  await app.close();
});

test('zoom con los controles y ajuste a la ventana', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Zoom');
  const zoom = page.getByTestId('zoom-value');
  const initial = parseInt((await zoom.textContent())!, 10);
  await page.getByRole('button', { name: 'Acercar' }).click();
  await expect.poll(async () => parseInt((await zoom.textContent())!, 10)).toBeGreaterThan(initial);
  await page.getByRole('button', { name: 'Ajustar a la ventana' }).click();
  await expect.poll(async () => parseInt((await zoom.textContent())!, 10)).toBe(initial);
  await stubMessageBox(app, 1);
  await app.close();
});

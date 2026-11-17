import { expect, test } from '@playwright/test';
import path from 'node:path';
import type { Project } from '../../src/core/model/types';
import {
  center,
  drag,
  itemCount,
  launch,
  newFreeProject,
  saveAndRead,
  sceneHash,
  stubMessageBox,
  tempDir,
} from './helpers';

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

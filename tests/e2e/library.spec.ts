import { expect, test } from '@playwright/test';
import path from 'node:path';
import type { Group, Project } from '../../src/core/model/types';
import { center, drag, itemCount, launch, newFreeProject, saveAndRead, stubMessageBox, tempDir } from './helpers';

const items = (p: Project) => p.scenes[0]!.layers.flatMap((l) => l.items ?? []);

test('insertar desde la biblioteca, recolorear, desagrupar y volver a agrupar', async () => {
  const file = path.join(await tempDir(), 'biblioteca.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Biblioteca', 'Guiado');
  await expect(page.getByRole('tab', { name: 'Biblioteca' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'Añadir Casa' }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  await page.getByRole('group', { name: 'Tejado' }).getByRole('button', { name: 'Color #3f8f4f' }).click();
  let p = await saveAndRead(app, page, file);
  const house = items(p)[0] as Group;
  expect(house).toMatchObject({ type: 'group', source: { kind: 'library', id: 'casa' } });
  expect(house.slots!.find((s) => s.id === 'secondary')!.color).toBe('#3f8f4f');
  expect(JSON.stringify(house.children)).toContain('#3f8f4f');

  await page.getByRole('button', { name: 'Desagrupar' }).click();
  await expect.poll(() => itemCount(page)).toBeGreaterThan(10);
  await page.keyboard.press('Control+g');
  await expect.poll(() => itemCount(page)).toBe(1);
  p = await saveAndRead(app, page, file);
  expect(items(p)[0]!.type).toBe('group');
  await stubMessageBox(app, 1);
  await app.close();
});

test('escena de partida y personaje creado con el constructor', async () => {
  const file = path.join(await tempDir(), 'escena.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Escena', 'Guiado');
  await page.getByRole('tab', { name: 'Escenas' }).click();
  await page.getByRole('button', { name: /Casa en el campo/ }).click();
  await expect.poll(() => itemCount(page)).toBe(7); // 6 recursos + línea de suelo

  await page.getByRole('tab', { name: 'Todo' }).click();
  await page.getByRole('button', { name: 'Crear personaje…' }).click();
  await page.getByRole('radio', { name: 'Rizado' }).click();
  await page.getByRole('radio', { name: 'Sorpresa' }).click();
  await page.getByRole('radio', { name: 'Camiseta #c23b4e' }).click();
  await page.getByRole('button', { name: 'Añadir al lienzo' }).click();
  await expect.poll(() => itemCount(page)).toBe(8);

  const p = await saveAndRead(app, page, file);
  const character = items(p).at(-1) as Group;
  expect(character.source).toEqual({ kind: 'character', id: 'rizado/sorpresa/de-pie' });
  expect(character.slots!.find((s) => s.id === 'shirt')!.color).toBe('#c23b4e');
  await stubMessageBox(app, 1);
  await app.close();
});

test('arrastrar un recurso de la biblioteca al lienzo', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Arrastrar', 'Mixto');
  await page.getByRole('button', { name: 'Añadir Árbol' }).dragTo(page.getByTestId('overlay-canvas'), {
    targetPosition: { x: 200, y: 200 },
  });
  await expect.poll(() => itemCount(page)).toBe(1);
  await stubMessageBox(app, 1);
  await app.close();
});

test('las guías magnéticas mantienen el centro y Alt las desactiva', async () => {
  const file = path.join(await tempDir(), 'guias.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Guías', 'Guiado');
  await page.getByRole('button', { name: 'Añadir Casa' }).click();
  const xOf = (p: Project) => (items(p)[0]!.transform.x as { value: number }).value;
  const start = xOf(await saveAndRead(app, page, file));

  const c = await center(page);
  await drag(page, { x: c.x, y: c.y + 20 }, { x: c.x + 5, y: c.y + 20 }, 5);
  expect(xOf(await saveAndRead(app, page, file))).toBeCloseTo(start, 6);

  await page.keyboard.down('Alt');
  await drag(page, { x: c.x, y: c.y + 20 }, { x: c.x + 5, y: c.y + 20 }, 5);
  await page.keyboard.up('Alt');
  expect(xOf(await saveAndRead(app, page, file))).toBeGreaterThan(start + 1);
  await stubMessageBox(app, 1);
  await app.close();
});

test('cambiar de modo conserva el contenido y ajusta las ayudas', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Modos', 'Guiado');
  await page.getByRole('tab', { name: 'Escenas' }).click();
  await page.getByRole('button', { name: /De noche/ }).click();
  const n = await itemCount(page);
  await expect(page.getByRole('complementary', { name: 'Primeros pasos' })).toBeVisible();

  await page.getByRole('radio', { name: 'Libre' }).click();
  await expect(page.getByRole('complementary', { name: 'Primeros pasos' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Capas' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Guías magnéticas' })).toHaveAttribute('aria-pressed', 'false');
  expect(await itemCount(page)).toBe(n);

  await page.getByRole('radio', { name: 'Guiado' }).click();
  await expect(page.getByRole('tab', { name: 'Biblioteca' })).toHaveAttribute('aria-selected', 'true');
  expect(await itemCount(page)).toBe(n);
  await stubMessageBox(app, 1);
  await app.close();
});

test('el proyecto de ejemplo se abre desde el inicio con sus tres escenas', async () => {
  const { app, page } = await launch(await tempDir());
  await page.getByRole('button', { name: 'Ver un ejemplo' }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Ejemplo: mi primera historia');
  await expect(page.getByRole('tablist', { name: 'Escenas' }).getByRole('tab')).toHaveText([
    'Había una vez',
    'Un día en la ciudad',
    'Ahora tú',
  ]);
  await expect.poll(() => itemCount(page)).toBeGreaterThan(5);
  // Se puede reproducir y es un proyecto nuevo sin guardar.
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await expect(page.getByTestId('timeline-time')).not.toContainText('00:00:00 /', { timeout: 3000 });
  await page.getByRole('button', { name: 'Pausa' }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Cambios sin guardar');
  await stubMessageBox(app, 1);
  await app.close();
});

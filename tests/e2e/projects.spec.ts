import { expect, test } from '@playwright/test';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createProject, killHard, launch, stubMessageBox, stubOpenDialog, stubSaveDialog, tempDir } from './helpers';

test('crear, guardar, cerrar y reabrir un proyecto sin pérdida', async () => {
  const userData = await tempDir();
  const docs = await tempDir();
  const file = path.join(docs, 'Mi cuento.dwings');

  let { app, page } = await launch(userData);
  await createProject(page, 'Mi cuento');
  await expect(page.getByTestId('save-status')).toHaveText('Cambios sin guardar');
  await page.getByRole('radio', { name: 'Libre' }).click();

  await stubSaveDialog(app, file);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Guardado');
  expect((await stat(file)).size).toBeGreaterThan(0);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle())).toBe(
    'Mi cuento — Dra-Wings',
  );

  await app.close();
  ({ app, page } = await launch(userData));
  const recentItem = page.getByRole('button', { name: /^Mi cuento/ });
  await expect(recentItem).toBeVisible();
  await recentItem.click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Mi cuento');
  await expect(page.getByRole('radio', { name: 'Libre' })).toHaveAttribute('data-state', 'on');
  await expect(page.getByTestId('save-status')).toHaveText('Guardado');
  await app.close();
});

test('renombrar, cambiar de modo, deshacer y rehacer', async () => {
  const { app, page } = await launch(await tempDir());
  await createProject(page, 'Uno');
  const name = page.getByLabel('Nombre del proyecto');
  await name.fill('Dos');
  await name.press('Enter');
  await page.getByRole('radio', { name: 'Mixto' }).click();

  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('radio', { name: 'Guiado' })).toHaveAttribute('data-state', 'on');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(name).toHaveValue('Uno');
  await page.keyboard.press('Control+y');
  await expect(name).toHaveValue('Dos');
  await stubMessageBox(app, 1); // «No guardar» al cerrar
  await app.close();
});

test('recupera el trabajo sin guardar tras un cierre inesperado', async () => {
  const userData = await tempDir();
  let { app, page } = await launch(userData);
  await createProject(page, 'Borrador');
  const name = page.getByLabel('Nombre del proyecto');
  await name.fill('Borrador importante');
  await name.press('Enter');
  // El autoguardado escribe la recuperación a los 3 s de inactividad.
  await expect
    .poll(async () => readdir(path.join(userData, 'recovery')).catch(() => []), {
      timeout: 10_000,
    })
    .toHaveLength(1);
  await expect
    .poll(async () => {
      const [f] = await readdir(path.join(userData, 'recovery'));
      return JSON.parse(await readFile(path.join(userData, 'recovery', f!), 'utf8')).project.name;
    })
    .toBe('Borrador importante');

  await killHard(app);
  ({ app, page } = await launch(userData));
  await expect(page.getByText('Trabajo sin guardar')).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Borrador importante');
  await expect(page.getByTestId('save-status')).toHaveText('Cambios sin guardar');
  await stubMessageBox(app, 1); // «No guardar» al cerrar
  await app.close();
});

test('muestra un error comprensible al abrir un archivo dañado', async () => {
  const dir = await tempDir();
  const bad = path.join(dir, 'roto.dwings');
  await writeFile(bad, 'esto no es un proyecto');
  const { app, page } = await launch(await tempDir());
  await stubOpenDialog(app, bad);
  await page.getByRole('button', { name: 'Abrir proyecto…' }).click();
  await expect(page.getByRole('alert')).toContainText('no es un proyecto de Dra-Wings');
  await expect(page.getByRole('button', { name: 'Nuevo proyecto' })).toBeVisible();
  await app.close();
});

test('al cerrar con cambios pregunta y permite cancelar o guardar', async () => {
  const docs = await tempDir();
  const file = path.join(docs, 'cierre.dwings');
  const { app, page } = await launch(await tempDir());
  await createProject(page, 'Cierre');

  await stubMessageBox(app, 2); // Cancelar
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Cierre');

  await stubMessageBox(app, 0); // Guardar
  await stubSaveDialog(app, file);
  const closed = app.waitForEvent('close');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  await closed;
  expect((await stat(file)).size).toBeGreaterThan(0);
});

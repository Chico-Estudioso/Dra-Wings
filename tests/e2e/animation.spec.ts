import { expect, test, type Page } from '@playwright/test';
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

const PX_PER_SECOND = 80; // zoom inicial de la línea de tiempo

async function scrubTo(page: Page, seconds: number) {
  const b = (await page.getByTestId('timeline-scroll').boundingBox())!;
  await page.mouse.click(b.x + seconds * PX_PER_SECOND + 1, b.y + 10);
}

const items = (p: Project, scene = 0) => p.scenes[scene]!.layers.flatMap((l) => l.items ?? []);

test('lo dibujado aparece en secuencia y la vista previa muestra el instante', async () => {
  const file = path.join(await tempDir(), 'secuencia.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Secuencia');
  const c = await center(page);
  await drag(page, { x: c.x - 200, y: c.y - 60 }, { x: c.x + 200, y: c.y - 60 }, 20);
  await drag(page, { x: c.x - 200, y: c.y + 60 }, { x: c.x + 200, y: c.y + 60 }, 20);
  await expect(page.getByTestId('timeline-bar')).toHaveCount(2);

  const p = await saveAndRead(app, page, file);
  const [a, b] = items(p);
  expect(a!.in).toBe(0);
  expect(a!.enter?.kind).toBe('draw');
  expect(b!.in).toBe(a!.in + a!.enter!.duration);

  const editHash = await sceneHash(page);
  await scrubTo(page, 0.05);
  await expect(page.getByRole('button', { name: 'Vista previa' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => sceneHash(page)).not.toBe(editHash);
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect.poll(() => sceneHash(page)).toBe(editHash);
  await stubMessageBox(app, 1);
  await app.close();
});

test('grabar movimiento crea keyframes al mover en otro instante', async () => {
  const file = path.join(await tempDir(), 'keyframes.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Keyframes');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 60, y: c.y - 40 }, { x: c.x + 60, y: c.y + 40 }, 4);
  await page.getByRole('button', { name: 'Grabar movimiento' }).click();
  await scrubTo(page, 3);
  await expect(page.getByTestId('timeline-time')).toContainText('00:03:00');
  // Al tocar el lienzo se sale de la vista previa y se mueve la forma en el instante del cabezal.
  await drag(page, { x: c.x - 30, y: c.y + 40 }, { x: c.x + 120, y: c.y + 40 });
  const p = await saveAndRead(app, page, file);
  const x = items(p)[0]!.transform.x;
  expect('keys' in x && x.keys.length).toBe(2);
  await expect(page.getByRole('button', { name: /^Keyframe en / })).toHaveCount(2);
  await stubMessageBox(app, 1);
  await app.close();
});

test('escenas: añadir, dibujar en cada una y cambiar entre ellas', async () => {
  const file = path.join(await tempDir(), 'escenas.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Escenas');
  await page.getByRole('button', { name: 'Nueva escena' }).click();
  await expect(page.getByRole('tab', { name: 'Escena 2' })).toHaveAttribute('aria-selected', 'true');
  const c = await center(page);
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await expect.poll(() => itemCount(page)).toBe(1);
  await page.getByRole('tab', { name: 'Escena 1' }).click();
  await expect.poll(() => itemCount(page)).toBe(0);
  const p = await saveAndRead(app, page, file);
  expect(p.scenes.map((s) => s.name)).toEqual(['Escena 1', 'Escena 2']);
  expect(items(p, 1)).toHaveLength(1);
  await stubMessageBox(app, 1);
  await app.close();
});

test('capa de fotogramas: un dibujo por fotograma', async () => {
  const file = path.join(await tempDir(), 'fotogramas.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Fotogramas');
  await page.getByRole('button', { name: 'Nueva capa de fotogramas' }).click();
  const c = await center(page);
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await page.getByRole('button', { name: 'Fotograma', exact: true }).click();
  await expect(page.getByTestId('timeline-time')).toContainText('00:00:02');
  await drag(page, { x: c.x - 100, y: c.y + 40 }, { x: c.x + 100, y: c.y + 40 });
  const p = await saveAndRead(app, page, file);
  const frames = p.scenes[0]!.layers.find((l) => l.kind === 'frames')!;
  expect(frames.cels!.map((cel) => cel.items.length)).toEqual([1, 1]);
  expect(frames.cels![1]!.start).toBe(frames.cels![0]!.start + frames.cels![0]!.duration);
  await stubMessageBox(app, 1);
  await app.close();
});

test('reproducir avanza el cabezal y pausa lo detiene', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Reproducir');
  const c = await center(page);
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await expect(page.getByTestId('timeline-time')).not.toContainText('00:00:00 /', { timeout: 3000 });
  await page.getByRole('button', { name: 'Pausa' }).click();
  const t1 = await page.getByTestId('timeline-time').textContent();
  await page.waitForTimeout(400);
  expect(await page.getByTestId('timeline-time').textContent()).toBe(t1);
  await stubMessageBox(app, 1);
  await app.close();
});

test('animaciones rápidas de un clic y suavizado del movimiento', async () => {
  const file = path.join(await tempDir(), 'rapidas.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Rápidas');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 40, y: c.y - 30 }, { x: c.x + 40, y: c.y + 30 }, 4);
  const quick = page.getByRole('group', { name: 'Animaciones rápidas' });
  await quick.getByRole('button', { name: /^Saltar/ }).click();
  // Los keyframes aparecen en la línea de tiempo (rombos de la selección).
  await expect(page.getByRole('button', { name: /^Keyframe en/ }).first()).toBeVisible();

  await quick.getByRole('radio', { name: 'Derecha' }).click();
  await quick.getByRole('button', { name: /^Entrar/ }).click();
  await page.getByLabel('Suavizado del movimiento').selectOption({ label: 'Rebote' });

  const p = await saveAndRead(app, page, file);
  const shape = items(p)[0]!;
  const xs = shape.transform.x;
  const ys = shape.transform.y;
  expect('keys' in xs && xs.keys[0]!.v).toBeGreaterThan(1920); // entra desde fuera por la derecha
  expect('keys' in ys && ys.keys.length).toBeGreaterThan(2); // el salto
  expect('keys' in xs && xs.keys.every((k) => k.ease === 'bounce')).toBe(true);
  await stubMessageBox(app, 1);
  await app.close();
});

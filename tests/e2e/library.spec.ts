import { expect, test } from '@playwright/test';
import path from 'node:path';
import type { Group, Project } from '../../src/core/model/types';
import {
  center,
  drag,
  itemCount,
  launch,
  newFreeProject,
  saveAndRead,
  sceneHash,
  stubMessageBox,
  stubOpenDialog,
  tempDir,
} from './helpers';
import { writeFile } from 'node:fs/promises';
import { speechWav } from './media-files';

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

test('un personaje cambia de expresión y de postura a mitad de escena', async () => {
  const file = path.join(await tempDir(), 'expresiones.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Expresiones', 'Guiado');
  await page.getByRole('button', { name: 'Añadir Alex' }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  const look = page.getByRole('group', { name: 'Expresión y postura' });
  await expect(look.getByLabel('Expresión')).toHaveValue('feliz');

  // Cabezal a 2 s (80 px por segundo en la línea de tiempo): triste y saludando desde ahí.
  const ruler = (await page.getByTestId('timeline-scroll').boundingBox())!;
  await page.mouse.click(ruler.x + 2 * 80 + 1, ruler.y + 10);
  await expect(page.getByTestId('timeline-time')).toContainText('00:02:00');
  await look.getByLabel('Expresión').selectOption({ label: 'Triste' });
  await look.getByLabel('Postura').selectOption({ label: 'Saludando' });
  await expect(look.getByRole('listitem')).toHaveCount(1);
  await expect(look.getByRole('listitem')).toContainText('Triste, saludando');
  await expect(page.getByRole('button', { name: 'Cambio de aspecto en 00:02:00' })).toBeVisible();

  // Antes del cambio sigue como estaba.
  await page.mouse.click(ruler.x + 0.5 * 80 + 1, ruler.y + 10);
  await expect(look.getByLabel('Expresión')).toHaveValue('feliz');
  await expect(look.getByLabel('Postura')).toHaveValue('de-pie');

  const p = await saveAndRead(app, page, file);
  const alex = items(p)[0] as Group;
  expect(alex.source?.id).toBe('corto/feliz/de-pie');
  expect(alex.swaps).toHaveLength(1);
  expect(alex.swaps![0]).toMatchObject({ t: 2 * 705_600_000, variant: 'corto/triste/saludando' });

  // Quitar el cambio desde la lista.
  await look.getByRole('button', { name: 'Quitar el cambio de 00:02:00' }).click();
  await expect(look.getByRole('listitem')).toHaveCount(0);
  await stubMessageBox(app, 1);
  await app.close();
});

test('un personaje habla con la narración: la boca sigue a la voz', async () => {
  test.setTimeout(90_000);
  const dir = await tempDir();
  const voice = path.join(dir, 'voz.wav');
  await writeFile(voice, speechWav(6));
  const file = path.join(dir, 'habla.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Habla', 'Guiado');
  await page.getByRole('button', { name: 'Trazo vivo: Normal' }).click();
  await page.getByRole('radio', { name: 'Quieto' }).check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Añadir Alex' }).click();
  await page.getByLabel('Vida automática').selectOption({ label: 'Quieto' });
  await page.getByRole('checkbox', { name: 'Habla con la narración' }).check();

  await stubOpenDialog(app, voice);
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByRole('button', { name: 'Narración (voz)' }).click();
  await expect(page.getByTestId('voice-status')).toHaveText('Voz lista para los personajes', { timeout: 30_000 });

  // 3,3 s: en mitad de una sílaba. 3,17 s (fotograma 3,167 s): casi al final del silencio que
  // empieza en 3,0 s, con la boca ya cerrada.
  const ruler = (await page.getByTestId('timeline-scroll').boundingBox())!;
  const hashAt = async (s: number) => {
    await page.mouse.click(ruler.x + s * 80 + 1, ruler.y + 10);
    await page.waitForTimeout(150);
    return sceneHash(page);
  };
  expect(await hashAt(3.3)).not.toBe(await hashAt(3.17));

  const p: Project = await saveAndRead(app, page, file);
  const alex = items(p)[0] as Group;
  expect(alex.talk).toBe(true);
  expect(p.assets.find((a) => a.mime.startsWith('audio'))!.voice!.levels.length).toBeGreaterThan(150);
  await stubMessageBox(app, 1);
  await app.close();
});

test('guion rápido: una escena por párrafo con el texto escribiéndose', async () => {
  const file = path.join(await tempDir(), 'guion.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Guion', 'Guiado');
  await page.getByRole('tab', { name: 'Escenas' }).click();
  await page.getByRole('button', { name: 'Crear escenas desde un guion…' }).click();
  await page
    .getByRole('textbox', { name: 'Guion', exact: true })
    .fill(
      'Había una vez una niña que soñaba con volar.\n\nUn día encontró unas alas de papel.\n\nY salió por la ventana.',
    );
  await expect(page.getByText('Se crearán 3 escenas.')).toBeVisible();
  await page.getByLabel('Escritura de los textos').selectOption({ label: 'Una palabra en cada golpe' });
  await page.getByRole('button', { name: 'Crear escenas' }).click();
  // La escena vacía del proyecto nuevo se aprovecha: 3 escenas en total.
  await expect(page.getByRole('tablist', { name: 'Escenas' }).getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tablist', { name: 'Escenas' }).getByRole('tab').first()).toHaveText(
    'Había una vez una niña que…',
  );

  const p = await saveAndRead(app, page, file);
  expect(p.scenes).toHaveLength(3);
  for (const s of p.scenes) {
    const [t] = s.layers.flatMap((l) => l.items ?? []);
    expect(t).toMatchObject({ type: 'text', reveal: 'beat-words', enter: { kind: 'draw' }, align: 'center' });
    expect(s.duration).toBeGreaterThan(705_600_000);
  }
  await stubMessageBox(app, 1);
  await app.close();
});

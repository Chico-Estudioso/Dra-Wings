import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { TICKS_PER_SECOND } from '../../src/core/time/ticks';
import { itemCount, launch, newFreeProject, saveAndRead, stubMessageBox, stubOpenDialog, tempDir } from './helpers';
import { solidPng, toneWav } from './media-files';

/** Color del píxel central del lienzo de escena. */
const centerPixel = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"]')!;
    return [
      ...c
        .getContext('2d')!
        .getImageData(c.width >> 1, c.height >> 1, 1, 1)
        .data.slice(0, 3),
    ];
  });

test('imagen, narración y marcas se importan, se guardan dentro del proyecto y se reabren en otro equipo', async () => {
  const dir = await tempDir();
  const png = path.join(dir, 'Foto roja.png');
  const wav = path.join(dir, 'voz.wav');
  const file = path.join(dir, 'medios.dwings');
  await writeFile(png, solidPng(40, 30, [220, 30, 40]));
  await writeFile(wav, toneWav(1.5));

  let { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Medios');

  // Imagen: se coloca centrada y se dibuja de verdad (no el marcador gris).
  await stubOpenDialog(app, png);
  await page.getByRole('button', { name: 'Importar imagen' }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  await expect.poll(() => centerPixel(page)).toEqual([220, 30, 40]);

  // Narración en el cabezal, con su forma de onda y su panel.
  await stubOpenDialog(app, wav);
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByRole('button', { name: 'Narración (voz)' }).click();
  await expect(page.getByTestId('audio-clip')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Narración' })).toBeVisible();

  // Marca con la tecla M; se renombra desde su panel.
  await page.getByTestId('timeline-scroll').click({ position: { x: 81, y: 10 } });
  await page.keyboard.press('m');
  await expect(page.getByTestId('marker')).toHaveCount(1);
  await page.getByLabel('Nombre de la marca').fill('Entra la voz');
  await page.getByLabel('Nombre de la marca').press('Enter');
  await expect(page.getByRole('button', { name: 'Marca «Entra la voz»' })).toBeVisible();

  const p = await saveAndRead(app, page, file);
  expect(p.assets.map((a) => a.mime).sort()).toEqual(['audio/wav', 'image/png']);
  const clip = p.audioTracks[0]!.clips[0]!;
  expect(p.audioTracks[0]!.kind).toBe('narration');
  expect(clip.duration).toBe(1.5 * TICKS_PER_SECOND);
  expect(p.markers).toMatchObject([{ label: 'Entra la voz' }]);
  const zipped = Object.keys(unzipSync(await readFile(file)));
  expect(zipped.filter((n) => n.startsWith('media/'))).toHaveLength(2);

  // La reproducción avanza también con audio (con o sin dispositivo de salida).
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await expect(page.getByTestId('timeline-time')).not.toContainText('00:00:00 /', { timeout: 3000 });
  await page.getByRole('button', { name: 'Pausa' }).click();
  await app.close();

  // Otro equipo: carpeta de datos vacía, los medios salen del propio archivo.
  ({ app, page } = await launch(await tempDir()));
  await stubOpenDialog(app, file);
  await page.getByRole('button', { name: /Abrir proyecto/ }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  await expect(page.getByTestId('audio-clip')).toHaveCount(1);
  await expect.poll(() => centerPixel(page)).toEqual([220, 30, 40]);
  await stubMessageBox(app, 1);
  await app.close();
});

test('al borrar una imagen, el archivo deja de incluir su medio y deshacer lo recupera', async () => {
  const dir = await tempDir();
  const png = path.join(dir, 'azul.png');
  const file = path.join(dir, 'poda.dwings');
  await writeFile(png, solidPng(8, 8, [20, 60, 200]));
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Poda');
  await stubOpenDialog(app, png);
  await page.getByRole('button', { name: 'Importar imagen' }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  expect((await saveAndRead(app, page, file)).assets).toHaveLength(1);

  await page.keyboard.press('Delete');
  await expect.poll(() => itemCount(page)).toBe(0);
  expect((await saveAndRead(app, page, file)).assets).toHaveLength(0);
  expect(Object.keys(unzipSync(await readFile(file))).some((n) => n.startsWith('media/'))).toBe(false);
  // Deshacer recupera la imagen: el medio sigue en la caché y se vuelve a guardar.
  await page.keyboard.press('Control+z');
  await expect.poll(() => itemCount(page)).toBe(1);
  expect((await saveAndRead(app, page, file)).assets).toHaveLength(1);
  await app.close();
});

test('efectos de sonido sintetizados en el cabezal', async () => {
  const file = path.join(await tempDir(), 'efectos.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Efectos');
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByRole('group', { name: 'Efectos de sonido' }).getByRole('button', { name: 'Pop' }).click();
  await expect(page.getByTestId('audio-clip')).toHaveCount(1);
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByRole('group', { name: 'Efectos de sonido' }).getByRole('button', { name: 'Ding' }).click();
  await expect(page.getByTestId('audio-clip')).toHaveCount(2);
  const p = await saveAndRead(app, page, file);
  expect(p.audioTracks.map((t) => t.kind)).toEqual(['sfx']);
  expect(p.assets.map((a) => a.name).sort()).toEqual(['Ding.wav', 'Pop.wav']);
  await stubMessageBox(app, 1);
  await app.close();
});

test('marcar al oído mientras suena y ajustar las escenas a las marcas', async () => {
  const file = path.join(await tempDir(), 'videoclip.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Videoclip');
  await page.getByRole('button', { name: 'Nueva escena' }).click();
  await page.getByRole('button', { name: 'Nueva escena' }).click();
  await page.getByRole('tab', { name: 'Escena 1' }).click();

  // Mientras suena se marca con M sin interrumpir la reproducción.
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await page.waitForTimeout(900);
  await page.keyboard.press('m');
  await page.waitForTimeout(900);
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await page.getByRole('button', { name: 'Pausa' }).click();

  // Al parar, el aviso ofrece ajustar las escenas.
  await expect(page.getByText('Has puesto 2 marcas mientras sonaba.')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar las escenas a las marcas' }).click();
  await expect(page.getByText('2 escenas ajustadas a las marcas.')).toBeVisible();

  const p = await saveAndRead(app, page, file);
  const [m1, m2] = p.markers.map((m) => m.t);
  expect(m1! / TICKS_PER_SECOND).toBeGreaterThan(0.5);
  expect(m2! - m1!).toBeGreaterThan(0.5 * TICKS_PER_SECOND);
  // Cada marca es un corte (alineado al fotograma); la última escena se queda como estaba.
  expect(p.scenes[0]!.duration).toBe(m1);
  expect(p.scenes[0]!.duration + p.scenes[1]!.duration).toBe(m2);
  expect(p.scenes[2]!.duration).toBe(5 * TICKS_PER_SECOND);

  // La escena 2 va de marca a marca. El panel de una marca también ofrece ajustar, y borrar todas las
  // marcas se deshace de una vez.
  await page.getByRole('tab', { name: 'Escena 2' }).click();
  await expect(page.getByTestId('marker')).toHaveCount(2);
  await page.getByTestId('marker').first().click();
  await expect(page.getByRole('button', { name: 'Ajustar las escenas a las marcas' })).toBeVisible();
  await page.getByRole('button', { name: /Borrar todas las marcas \(2\)/ }).click();
  await expect(page.getByTestId('marker')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('marker')).not.toHaveCount(0);
  await stubMessageBox(app, 1);
  await app.close();
});

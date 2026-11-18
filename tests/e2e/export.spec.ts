import { expect, test } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';
import {
  center,
  drag,
  launch,
  newFreeProject,
  stubMessageBox,
  stubOpenDialog,
  stubSaveDialog,
  tempDir,
} from './helpers';
import { solidPng, toneWav } from './media-files';

/** Lee el MP4 con mediabunny (solo demultiplexa: no hace falta WebCodecs en Node). */
async function probe(file: string) {
  const input = new Input({ source: new FilePathSource(file), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  const result = {
    mime: await input.getMimeType(),
    duration: await input.computeDuration(),
    video: video && {
      codec: video.codec,
      width: video.displayWidth,
      height: video.displayHeight,
      packets: (await video.computePacketStats()).packetCount,
    },
    audio: audio && { codec: audio.codec, sampleRate: audio.sampleRate, channels: audio.numberOfChannels },
  };
  input.dispose();
  return result;
}

test('exporta un MP4 con todas las escenas, imagen y narración', async () => {
  test.setTimeout(120_000);
  const dir = await tempDir();
  const out = path.join(dir, 'historia.mp4');
  await writeFile(path.join(dir, 'foto.png'), solidPng(64, 48, [30, 120, 220]));
  await writeFile(path.join(dir, 'voz.wav'), toneWav(1.5));

  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Historia');
  const c = await center(page);
  await drag(page, { x: c.x - 150, y: c.y }, { x: c.x + 150, y: c.y + 40 });
  await stubOpenDialog(app, path.join(dir, 'foto.png'));
  await page.getByRole('button', { name: 'Importar imagen' }).click();
  await stubOpenDialog(app, path.join(dir, 'voz.wav'));
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByRole('button', { name: 'Narración (voz)' }).click();
  await expect(page.getByTestId('audio-clip')).toHaveCount(1);
  // Segunda escena de 2 s: el vídeo dura 5 + 2 s.
  await page.getByRole('button', { name: 'Nueva escena' }).click();
  const duration = page.getByLabel('Duración de la escena en segundos');
  await duration.fill('2');
  await duration.press('Enter');

  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('radio', { name: /HD 1280 × 720/ }).click();
  await expect(page.getByTestId('export-summary')).toContainText('0:07 (210 fotogramas), con el audio');
  // Antes de exportar se ve qué códecs se van a usar (H.264 en todas las plataformas de CI).
  await expect(page.getByTestId('export-codecs')).toContainText('Formato: H.264 + ');
  await stubSaveDialog(app, out);
  await page.getByRole('button', { name: 'Exportar…' }).click();
  await expect(page.getByText('Vídeo exportado:')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('status')).toContainText('historia.mp4');

  const info = await probe(out);
  expect(info.mime).toContain('video/mp4');
  expect(info.video).toMatchObject({ width: 1280, height: 720, packets: 210 });
  expect(['avc', 'vp9', 'av1']).toContain(info.video!.codec);
  expect(info.audio).toMatchObject({ sampleRate: 48_000, channels: 2 });
  expect(['aac', 'opus']).toContain(info.audio!.codec);
  expect(info.duration).toBeGreaterThan(6.9);
  expect(info.duration).toBeLessThan(7.2);
  expect(await readdir(dir)).not.toContain('historia.mp4.part');

  await page.getByRole('button', { name: 'Cerrar' }).click();
  await stubMessageBox(app, 1);
  await app.close();
});

test('cancelar una exportación no deja archivos', async () => {
  test.setTimeout(120_000);
  const dir = await tempDir();
  const out = path.join(dir, 'larga.mp4');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Larga');
  const c = await center(page);
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  const duration = page.getByLabel('Duración de la escena en segundos');
  await duration.fill('120');
  await duration.press('Enter');

  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await stubSaveDialog(app, out);
  await page.getByRole('button', { name: 'Exportar…' }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByText(/Fotograma \d+ de 3600/)).toBeVisible({ timeout: 30_000 });
  // Mientras exporta, Esc no cierra el diálogo.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('progressbar')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar exportación' }).click();
  await expect(page.getByText('Exportación cancelada')).toBeVisible();
  await expect.poll(() => readdir(dir)).toEqual([]);
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await stubMessageBox(app, 1);
  await app.close();
});

/** Ancho y alto de un PNG (cabecera IHDR). */
const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });

test('guarda el fotograma del cabezal como imagen PNG', async () => {
  const dir = await tempDir();
  const out = path.join(dir, 'fotograma.png');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Portada');
  const c = await center(page);
  await drag(page, { x: c.x - 150, y: c.y }, { x: c.x + 150, y: c.y + 40 });
  // A los 4 s el trazo ya está dibujado del todo (80 px por segundo en la línea de tiempo).
  const tl = (await page.getByTestId('timeline-scroll').boundingBox())!;
  await page.mouse.click(tl.x + 4 * 80 + 1, tl.y + 10);

  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('radio', { name: /HD 1280 × 720/ }).click();
  await stubSaveDialog(app, out);
  await page.getByRole('button', { name: 'Guardar este fotograma…' }).click();
  await expect(page.getByRole('status')).toContainText('Imagen guardada: fotograma.png');
  const bytes = await readFile(out);
  expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(pngSize(bytes)).toEqual({ width: 1280, height: 720 });
  // El trazo está en la imagen: hay píxeles oscuros sobre el papel claro.
  const dark = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i]! + px[i + 1]! + px[i + 2]! < 200) n++;
    return n;
  }, bytes.toString('base64'));
  expect(dark).toBeGreaterThan(200);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // Desde el menú (Ctrl+Mayús+E), con la resolución del proyecto y un aviso.
  const out2 = path.join(dir, 'menu.png');
  await stubSaveDialog(app, out2);
  await app.evaluate(({ Menu }) => {
    const item = Menu.getApplicationMenu()!
      .items.flatMap((m) => m.submenu?.items ?? [])
      .find((i) => i.label === 'Guardar fotograma como imagen…')!;
    (item.click as () => void)();
  });
  await expect(page.getByText('Imagen guardada: menu.png')).toBeVisible();
  expect(pngSize(await readFile(out2))).toEqual({ width: 1920, height: 1080 });
  await expect(page.getByRole('button', { name: 'Mostrar en la carpeta' })).toBeVisible();
  await stubMessageBox(app, 1);
  await app.close();
});

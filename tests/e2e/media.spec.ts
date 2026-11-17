import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { unzipSync } from 'fflate';
import { TICKS_PER_SECOND } from '../../src/core/time/ticks';
import { itemCount, launch, newFreeProject, saveAndRead, stubMessageBox, stubOpenDialog, tempDir } from './helpers';

// Los medios de prueba se generan aquí: no hay binarios en el repositorio.

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** PNG de un solo color, `w`×`h`. */
function solidPng(w: number, h: number, [r, g, b]: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** WAV PCM de 16 bits, mono, con un tono de 440 Hz. */
function toneWav(seconds: number, rate = 8000): Buffer {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return b;
}

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

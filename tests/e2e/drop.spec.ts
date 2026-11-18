import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { TICKS_PER_SECOND } from '../../src/core/time/ticks';
import { itemCount, launch, newFreeProject, saveAndRead, stubMessageBox, tempDir } from './helpers';
import { solidPng, toneWav } from './media-files';

type FakeFile = { name: string; type: string; bytes: Buffer };

/** Suelta archivos sobre un elemento como si vinieran del explorador. */
async function dropFiles(page: Page, target: Locator, files: FakeFile[], at: { x: number; y: number }) {
  const dataTransfer = await page.evaluateHandle(
    (list) => {
      const dt = new DataTransfer();
      for (const f of list) dt.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.type }));
      return dt;
    },
    files.map((f) => ({ name: f.name, type: f.type, bytes: [...f.bytes] })),
  );
  await target.dispatchEvent('dragover', { dataTransfer, clientX: at.x, clientY: at.y });
  await target.dispatchEvent('drop', { dataTransfer, clientX: at.x, clientY: at.y });
}

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

test('imágenes al lienzo y audio a la línea de tiempo arrastrando desde el explorador', async () => {
  const file = path.join(await tempDir(), 'soltar.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Soltar');

  // Una imagen soltada en el centro del lienzo queda centrada ahí y se dibuja.
  const canvas = page.getByTestId('overlay-canvas');
  const box = (await canvas.boundingBox())!;
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await dropFiles(
    page,
    canvas,
    [{ name: 'verde.png', type: 'image/png', bytes: solidPng(60, 40, [40, 160, 70]) }],
    middle,
  );
  await expect.poll(() => itemCount(page)).toBe(1);
  await expect.poll(() => centerPixel(page)).toEqual([40, 160, 70]);

  // Audio soltado en la línea de tiempo (fuera de una pista): pregunta la pista y lo pone donde se soltó.
  const scroll = page.getByTestId('timeline-scroll');
  const tl = (await scroll.boundingBox())!;
  await dropFiles(page, scroll, [{ name: 'tema.wav', type: 'audio/wav', bytes: toneWav(1) }], {
    x: tl.x + 2 * 80 + 1,
    y: tl.y + 40,
  });
  await expect(page.getByRole('dialog', { name: '¿En qué pista va el audio?' })).toBeVisible();
  await page.getByRole('button', { name: 'Música' }).click();
  await expect(page.getByTestId('audio-clip')).toHaveCount(1);

  // Sobre una pista de audio ya existente no pregunta: va a esa pista, encadenado si choca.
  const row = page.locator('[data-track-kind="music"]');
  const r = (await row.boundingBox())!;
  await dropFiles(page, row, [{ name: 'otro.wav', type: 'audio/wav', bytes: toneWav(0.5) }], {
    x: tl.x + 2 * 80 + 10,
    y: r.y + r.height / 2,
  });
  await expect(page.getByTestId('audio-clip')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Lo que no es imagen ni audio se rechaza con un aviso.
  await dropFiles(page, canvas, [{ name: 'notas.txt', type: 'text/plain', bytes: Buffer.from('hola') }], middle);
  await expect(page.getByText(/solo imágenes y audio/)).toBeVisible();

  const p = await saveAndRead(app, page, file);
  expect(p.audioTracks.map((t) => t.kind)).toEqual(['music']);
  const [a, b] = p.audioTracks[0]!.clips;
  expect(a!.start / TICKS_PER_SECOND).toBeCloseTo(2, 1);
  expect(b!.start).toBe(a!.start + a!.duration);
  expect(p.assets.map((x) => x.name).sort()).toEqual(['otro.wav', 'tema.wav', 'verde.png']);
  await stubMessageBox(app, 1);
  await app.close();
});

import { expect, test } from '@playwright/test';
import { launch, newFreeProject, stubMessageBox, tempDir } from './helpers';

// En Windows los runners tienen pantallas de 1024×768: la ventana queda más baja que en desarrollo.
test('en una ventana pequeña el lienzo no invade la línea de tiempo', async () => {
  const { app, page } = await launch(await tempDir());
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(960, 600));
  await newFreeProject(page, 'Ventana pequeña');
  await expect
    .poll(async () => {
      const canvas = (await page.getByTestId('canvas-host').boundingBox())!;
      const timeline = (await page.getByRole('region', { name: 'Línea de tiempo' }).boundingBox())!;
      return canvas.y + canvas.height <= timeline.y + 1;
    })
    .toBe(true);
  // El botón de reproducir recibe el clic (no lo tapa el lienzo).
  await page.getByRole('button', { name: 'Reproducir' }).click({ timeout: 3000 });
  await page.getByRole('button', { name: 'Pausa' }).click({ timeout: 3000 });
  await stubMessageBox(app, 1);
  await app.close();
});

test('a 1024 px las opciones de cada herramienta caben sin desplazarse', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Opciones');
  const overflow = () =>
    page.evaluate(() => {
      const el = document.querySelector('.tool-options')!;
      return el.scrollWidth - el.clientWidth;
    });
  for (const key of ['b', 'e', 'g', 'r', 'l', 't']) {
    await page.keyboard.press(key);
    await expect.poll(overflow, { message: `herramienta ${key}` }).toBeLessThanOrEqual(0);
  }
  await stubMessageBox(app, 1);
  await app.close();
});

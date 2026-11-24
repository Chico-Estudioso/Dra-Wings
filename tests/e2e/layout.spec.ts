import { expect, test } from '@playwright/test';
import { launch, newFreeProject, stubMessageBox, tempDir } from './helpers';

// En Windows los runners tienen pantallas de 1024×768: la ventana queda más baja que en desarrollo.
test('en una ventana pequeña el lienzo no invade la línea de tiempo', async () => {
  const { app, page } = await launch(await tempDir());
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]!;
    win.unmaximize();
    win.setSize(960, 600);
  });
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

test('el panel lateral se estira, se pliega y se recuerda', async () => {
  const userData = await tempDir();
  let { app, page } = await launch(userData);
  await newFreeProject(page, 'Panel');
  const panel = page.getByRole('complementary', { name: 'Paneles' });
  const canvasWidth = async () => (await page.getByTestId('canvas-host').boundingBox())!.width;
  const w0 = (await panel.boundingBox())!.width;

  // Más ancho con el teclado (flecha izquierda: el borde va hacia el lienzo).
  const handle = page.getByRole('separator', { name: 'Ancho del panel lateral' });
  await handle.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(w0 + 60);

  // Plegado: el lienzo ocupa su sitio.
  const before = await canvasWidth();
  await page.getByRole('button', { name: 'Ocultar el panel lateral' }).click();
  await expect(panel).toBeHidden();
  await expect.poll(canvasWidth).toBeGreaterThan(before + 200);

  // Se recuerda al volver a abrir la aplicación.
  await stubMessageBox(app, 1);
  await app.close();
  ({ app, page } = await launch(userData));
  await newFreeProject(page, 'Panel 2');
  await expect(page.getByRole('complementary', { name: 'Paneles' })).toBeHidden();
  await page.getByRole('button', { name: 'Mostrar el panel lateral' }).click();
  await expect
    .poll(async () => (await page.getByRole('complementary', { name: 'Paneles' }).boundingBox())!.width)
    .toBeGreaterThan(w0 + 60);
  await stubMessageBox(app, 1);
  await app.close();
});

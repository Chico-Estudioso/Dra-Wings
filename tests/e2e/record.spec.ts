import { expect, test } from '@playwright/test';
import path from 'node:path';
import { TICKS_PER_SECOND } from '../../src/core/time/ticks';
import { launch, newFreeProject, saveAndRead, stubMessageBox, tempDir } from './helpers';

// Micrófono simulado de Chromium (emite un pitido): no hace falta hardware de audio en CI. No se usa
// --use-fake-ui-for-media-stream, que se saltaría los permisos: así se prueban los de la app.
const FAKE_MIC = ['--use-fake-device-for-media-stream'];

test('grabar la narración viendo el vídeo, repetir la toma y escucharla con la animación', async () => {
  test.setTimeout(60_000);
  const file = path.join(await tempDir(), 'grabacion.dwings');
  const { app, page } = await launch(await tempDir(), FAKE_MIC);
  await newFreeProject(page, 'Grabación');

  // Solo se concede el micrófono: la cámara sigue denegada.
  expect(
    await page.evaluate(() =>
      navigator.mediaDevices.getUserMedia({ video: true }).then(
        () => 'concedida',
        (e: DOMException) => e.name,
      ),
    ),
  ).toBe('NotAllowedError');

  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByRole('button', { name: 'Grabar narración…' }).click();
  // Es un panel sobre el lienzo, no una ventana modal: el vídeo se ve mientras se graba.
  const panel = page.getByRole('region', { name: 'Grabar narración' });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const status = page.getByTestId('record-status');
  await expect(status).toContainText('Empieza en 0:00');

  // El medidor se mueve con la entrada (el micrófono simulado pita a intervalos: se toma el máximo).
  const peak = await page.evaluate(async () => {
    const meter = document.querySelector('[role="meter"]')!;
    let max = 0;
    for (let i = 0; i < 50; i++) {
      max = Math.max(max, Number(meter.getAttribute('aria-valuenow')));
      await new Promise((r) => setTimeout(r, 50));
    }
    return max;
  });
  expect(peak).toBeGreaterThan(0);

  // Con «Reproducir el vídeo mientras grabo» (activado por defecto) la animación avanza.
  await panel.getByRole('button', { name: 'Grabar', exact: true }).click();
  await expect(status).toContainText('Grabando', { timeout: 6000 });
  await expect(page.getByTestId('timeline-time')).not.toContainText('00:00:00 /', { timeout: 3000 });
  await page.waitForTimeout(1000);
  // Intro detiene la grabación (no hace de reproducir/pausa).
  await page.keyboard.press('Enter');
  await expect(status).toContainText('colocada en 0:00');
  await expect(page.getByTestId('audio-clip')).toHaveCount(1);

  // Repetir toma: se quita la anterior y se graba de nuevo desde el mismo punto.
  await panel.getByRole('button', { name: 'Repetir toma' }).click();
  await expect(status).toContainText('Grabando', { timeout: 6000 });
  await page.waitForTimeout(1500);
  await panel.getByRole('button', { name: 'Detener' }).click();
  await expect(status).toContainText('colocada en 0:00');
  await expect(page.getByTestId('audio-clip')).toHaveCount(1);

  // Escuchar con el vídeo reproduce desde el inicio de la toma.
  await panel.getByRole('button', { name: 'Escuchar con el vídeo' }).click();
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await page.getByRole('button', { name: 'Pausa' }).click();
  await panel.getByRole('button', { name: 'Salir de la grabación' }).click();
  await expect(panel).toHaveCount(0);

  const p = await saveAndRead(app, page, file);
  expect(p.audioTracks.map((t) => t.kind)).toEqual(['narration']);
  expect(p.assets[0]).toMatchObject({ mime: 'audio/wav' });
  expect(p.assets[0]!.name).toMatch(/^Narración .*\.wav$/);
  const seconds = p.audioTracks[0]!.clips[0]!.duration / TICKS_PER_SECOND;
  expect(seconds).toBeGreaterThan(1.2);
  expect(seconds).toBeLessThan(5);
  await stubMessageBox(app, 1);
  await app.close();
});

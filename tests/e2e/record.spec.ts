import { expect, test } from '@playwright/test';
import path from 'node:path';
import { TICKS_PER_SECOND } from '../../src/core/time/ticks';
import { launch, newFreeProject, saveAndRead, stubMessageBox, tempDir } from './helpers';

// Micrófono simulado de Chromium (emite un pitido): no hace falta hardware de audio en CI. No se usa
// --use-fake-ui-for-media-stream, que se saltaría los permisos: así se prueban los de la app.
const FAKE_MIC = ['--use-fake-device-for-media-stream'];

test('grabar la narración con el micrófono la coloca en la pista de narración', async () => {
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
  const status = page.getByTestId('record-status');
  await expect(status).toHaveText('Listo para grabar.');
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
  await page.getByRole('checkbox', { name: /Reproducir la animación/ }).uncheck();
  await page.getByRole('button', { name: 'Grabar', exact: true }).click();
  await expect(status).toContainText('Grabando', { timeout: 6000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Detener' }).click();
  await expect(status).toContainText('Escucha la toma');
  await page.getByRole('button', { name: 'Usar grabación' }).click();
  await expect(page.getByTestId('audio-clip')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const p = await saveAndRead(app, page, file);
  expect(p.audioTracks.map((t) => t.kind)).toEqual(['narration']);
  expect(p.assets[0]).toMatchObject({ mime: 'audio/wav' });
  expect(p.assets[0]!.name).toMatch(/^Narración .*\.wav$/);
  const seconds = p.audioTracks[0]!.clips[0]!.duration / TICKS_PER_SECOND;
  expect(seconds).toBeGreaterThan(1.2);
  expect(seconds).toBeLessThan(4);
  await stubMessageBox(app, 1);
  await app.close();
});

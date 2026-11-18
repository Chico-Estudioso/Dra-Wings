import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '../../src/core/model/types';
import { center, drag, launch, newFreeProject, saveAndRead, stubMessageBox, stubOpenDialog, tempDir } from './helpers';
import { beatWav } from './media-files';

test('la música se analiza sola y los personajes pueden moverse a su ritmo', async () => {
  test.setTimeout(90_000);
  const dir = await tempDir();
  const song = path.join(dir, 'cancion.wav');
  await writeFile(song, beatWav(120, 12));
  const file = path.join(dir, 'ritmo.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Videoclip');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 50, y: c.y - 40 }, { x: c.x + 50, y: c.y + 40 }, 4);

  // Vida al ritmo antes de tener música: sigue 120 BPM y lo avisa.
  await page.getByLabel('Vida automática').selectOption({ label: 'Saltar al ritmo' });
  await expect(page.getByText(/Sigue un pulso de 120 BPM/)).toBeVisible();

  // Importar la canción en la pista de música: el ritmo se detecta solo.
  await stubOpenDialog(app, song);
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await page.getByRole('button', { name: 'Música' }).click();
  await expect(page.getByTestId('rhythm-status')).toContainText(/^1(19|20|21) BPM · \d+ golpes$/, { timeout: 30_000 });
  // Los golpes se ven en la regla (los de empezar compás, más marcados).
  await expect(page.locator('.tl-beat').first()).toBeAttached();
  expect(await page.locator('.tl-beat.is-bar').count()).toBeGreaterThan(1);

  const p: Project = await saveAndRead(app, page, file);
  const beats = p.assets[0]!.beats!;
  expect(beats.bpm).toBeGreaterThan(118);
  expect(beats.bpm).toBeLessThan(122);
  expect(beats.ticks.length).toBeGreaterThan(18);
  const shape = p.scenes[0]!.layers.flatMap((l) => l.items ?? [])[0]!;
  expect(shape.life).toEqual({ kind: 'beat-bounce', amount: 1 });
  await stubMessageBox(app, 1);
  await app.close();
});

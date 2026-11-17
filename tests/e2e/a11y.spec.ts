import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { center, drag, launch, newFreeProject, stubMessageBox, tempDir } from './helpers';

/** Problemas graves o críticos de accesibilidad (WCAG 2.1 AA) en lo que se ve ahora. */
async function audit(page: Page, label: string) {
  // Modo legacy: analiza en la propia página (Electron no deja abrir páginas auxiliares).
  const r = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of bad)
    console.log(
      `A11Y [${label}] ${v.id} (${v.impact}): ${v.help}\n  ${v.nodes
        .slice(0, 4)
        .map((n) => n.target.join(' '))
        .join('\n  ')}`,
    );
  return bad.map((v) => `${label}: ${v.id}`);
}

test('las pantallas principales no tienen problemas graves de accesibilidad', async () => {
  test.setTimeout(120_000);
  const { app, page } = await launch(await tempDir());
  const problems: string[] = [];
  problems.push(...(await audit(page, 'inicio')));

  await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
  problems.push(...(await audit(page, 'nuevo proyecto')));
  await page.keyboard.press('Escape');

  await newFreeProject(page, 'Accesible', 'Guiado');
  problems.push(...(await audit(page, 'editor guiado')));

  await page.getByRole('button', { name: 'Añadir Casa' }).click();
  problems.push(...(await audit(page, 'elemento seleccionado')));

  await page.getByRole('radio', { name: /Libre/ }).click();
  const c = await center(page);
  await page.keyboard.press('b');
  await drag(page, { x: c.x - 100, y: c.y + 80 }, { x: c.x + 100, y: c.y + 90 });
  problems.push(...(await audit(page, 'editor libre')));

  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await expect(page.getByTestId('export-codecs')).toBeVisible();
  problems.push(...(await audit(page, 'exportar')));
  await page.keyboard.press('Escape');

  // Hoja de atajos con la tecla ?.
  await page.locator('body').press('?');
  await expect(page.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible();
  await expect(page.getByText('Exportar vídeo')).toBeVisible();
  problems.push(...(await audit(page, 'atajos')));
  await page.keyboard.press('Escape');

  // Tema oscuro (Windows en modo oscuro).
  await page.emulateMedia({ colorScheme: 'dark' });
  problems.push(...(await audit(page, 'editor oscuro')));
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await expect(page.getByTestId('export-codecs')).toBeVisible();
  problems.push(...(await audit(page, 'exportar oscuro')));
  await page.keyboard.press('Escape');

  expect(problems).toEqual([]);
  await stubMessageBox(app, 1);
  await app.close();
});

test('el lienzo se maneja con el teclado: Tab recorre los elementos y se anuncia la selección', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Teclado');
  const c = await center(page);
  await drag(page, { x: c.x - 150, y: c.y - 40 }, { x: c.x - 20, y: c.y - 40 });
  await page.keyboard.press('r');
  await drag(page, { x: c.x + 20, y: c.y }, { x: c.x + 120, y: c.y + 60 }, 4);
  await page.keyboard.press('Escape');

  const canvas = page.getByRole('application', { name: /Lienzo de la escena/ });
  await canvas.focus();
  await page.keyboard.press('Tab');
  await expect(canvas.getByText('Trazo, 1 de 2')).toBeAttached();
  await page.keyboard.press('Tab');
  await expect(canvas.getByText('Forma, 2 de 2')).toBeAttached();
  // Mayús+Tab vuelve atrás y Supr elimina lo seleccionado.
  await page.keyboard.press('Shift+Tab');
  await expect(canvas.getByText('Trazo, 1 de 2')).toBeAttached();
  await page.keyboard.press('Delete');
  await expect.poll(() => page.getByTestId('item-count').textContent()).toBe('1 elemento');
  // Tras el último elemento, Tab saca el foco del lienzo.
  await canvas.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(canvas).not.toBeFocused();
  await stubMessageBox(app, 1);
  await app.close();
});

import { expect, test } from '@playwright/test';
import path from 'node:path';
import type { Project } from '../../src/core/model/types';
import {
  center,
  drag,
  itemCount,
  launch,
  newFreeProject,
  saveAndRead,
  sceneHash,
  stubMessageBox,
  tempDir,
} from './helpers';

test('trazos, formas y texto se guardan y se ven igual al reabrir', async () => {
  const userData = await tempDir();
  const file = path.join(await tempDir(), 'dibujo.dwings');
  let { app, page } = await launch(userData);
  await newFreeProject(page);
  const c = await center(page);

  await drag(page, { x: c.x - 200, y: c.y }, { x: c.x - 50, y: c.y - 60 });
  await drag(page, { x: c.x - 200, y: c.y + 40 }, { x: c.x - 50, y: c.y + 80 });
  await page.keyboard.press('r');
  await drag(page, { x: c.x + 40, y: c.y - 40 }, { x: c.x + 160, y: c.y + 40 }, 4);
  await page.keyboard.press('t');
  await page.mouse.click(c.x - 150, c.y + 150);
  await page.keyboard.type('Hola');
  await page.keyboard.press('Escape');
  await expect.poll(() => itemCount(page)).toBe(4);

  const project = await saveAndRead(app, page, file);
  const items = project.scenes[0]!.layers[0]!.items!;
  expect(items.map((i) => i.type)).toEqual(['stroke', 'stroke', 'shape', 'text']);
  expect(items[3]).toMatchObject({ type: 'text', text: 'Hola', font: 'hand' });
  const firstStroke = items[0]!;
  expect(firstStroke.type === 'stroke' && firstStroke.points.length / 4).toBeGreaterThan(5);
  const before = await sceneHash(page);

  await app.close();
  ({ app, page } = await launch(userData));
  await page.getByRole('button', { name: /^Dibujo/ }).click();
  await expect.poll(() => itemCount(page)).toBe(4);
  await expect.poll(() => sceneHash(page)).toBe(before);
  await app.close();
});

test('seleccionar, mover, rotar con mayúsculas y deshacer', async () => {
  const file = path.join(await tempDir(), 'mover.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Mover');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 60, y: c.y - 40 }, { x: c.x + 60, y: c.y + 40 }, 4);
  // Al terminar la forma se activa Seleccionar con la forma seleccionada.
  await expect(page.getByRole('button', { name: 'Seleccionar' })).toHaveAttribute('aria-pressed', 'true');
  const shapeOf = (p: Project) => p.scenes[0]!.layers[0]!.items![0]!;
  const valueOf = (a: unknown) => (a as { value: number }).value;
  const before = shapeOf(await saveAndRead(app, page, file));

  // Mover arrastrando el borde inferior (lejos de los tiradores).
  await drag(page, { x: c.x - 30, y: c.y + 40 }, { x: c.x + 70, y: c.y + 90 });
  const moved = shapeOf(await saveAndRead(app, page, file));
  expect(valueOf(moved.transform.x)).toBeGreaterThan(valueOf(before.transform.x));
  expect(valueOf(moved.transform.y)).toBeGreaterThan(valueOf(before.transform.y));
  expect(moved.transform.scaleX).toEqual({ value: 1 });

  // Rotar con Mayús: el tirador está ~28 px por encima del borde superior, que ahora está en c.y + 10.
  await page.keyboard.down('Shift');
  await drag(page, { x: c.x + 100, y: c.y - 20 }, { x: c.x + 300, y: c.y + 50 });
  await page.keyboard.up('Shift');
  expect(shapeOf(await saveAndRead(app, page, file)).transform.rotation).toEqual({ value: 90 });

  await page.keyboard.press('Control+z');
  expect(shapeOf(await saveAndRead(app, page, file)).transform.rotation).toEqual({ value: 0 });

  await page.keyboard.press('Delete');
  await expect.poll(() => itemCount(page)).toBe(0);
  await stubMessageBox(app, 1);
  await app.close();
});

test('la goma parte un trazo y se puede deshacer', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Goma');
  const c = await center(page);
  await drag(page, { x: c.x - 200, y: c.y }, { x: c.x + 200, y: c.y }, 30);
  await expect.poll(() => itemCount(page)).toBe(1);
  await page.keyboard.press('e');
  await drag(page, { x: c.x, y: c.y - 60 }, { x: c.x, y: c.y + 60 }, 10);
  await expect.poll(() => itemCount(page)).toBe(2);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  await stubMessageBox(app, 1);
  await app.close();
});

test('capas: bloquear impide dibujar, y se dibuja en la capa activa', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Capas');
  const c = await center(page);
  await page.getByRole('button', { name: 'Bloquear Capa 1' }).click();
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await expect(page.getByRole('status').filter({ hasText: 'está bloqueada' })).toBeVisible();
  await expect.poll(() => itemCount(page)).toBe(0);

  await page.getByRole('button', { name: 'Nueva capa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Capa 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await expect(page.locator('.layer-count').first()).toHaveText('1'); // Capa 2 aparece arriba
  await page.getByRole('button', { name: 'Ocultar Capa 2' }).click();
  await expect(page.getByRole('button', { name: 'Mostrar Capa 2' })).toBeVisible();
  await stubMessageBox(app, 1);
  await app.close();
});

test('zoom con los controles y ajuste a la ventana', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Zoom');
  const zoom = page.getByTestId('zoom-value');
  const initial = parseInt((await zoom.textContent())!, 10);
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await expect.poll(async () => parseInt((await zoom.textContent())!, 10)).toBeGreaterThan(initial);
  await page.getByRole('button', { name: 'Ajustar a la ventana' }).click();
  await expect.poll(async () => parseInt((await zoom.textContent())!, 10)).toBe(initial);
  await stubMessageBox(app, 1);
  await app.close();
});

test('ayudas al dibujar: forma rápida al mantener quieto y trazo de tinta', async () => {
  const file = path.join(await tempDir(), 'ayudas.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Ayudas');
  const c = await center(page);
  const strokes = (p: Project) => p.scenes[0]!.layers.flatMap((l) => l.items ?? []).filter((i) => i.type === 'stroke');

  /** Un círculo «a mano» de 90 px de radio; con `hold`, se mantiene quieto al final. */
  async function circle(cx: number, cy: number, hold: boolean) {
    await page.mouse.move(cx, cy - 90);
    await page.mouse.down();
    for (let i = 1; i <= 44; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * 1.03 * i) / 44;
      const r = 90 + (i % 3) - 1;
      await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    if (hold) await page.waitForTimeout(800);
    await page.mouse.up();
  }

  // Con el puntero quieto al final: un círculo limpio (mismo pincel, pocas variaciones de radio).
  await circle(c.x - 150, c.y, true);
  await expect.poll(() => itemCount(page)).toBe(1);
  // Sin mantenerlo: se queda a mano alzada.
  await circle(c.x + 150, c.y, false);
  await expect.poll(() => itemCount(page)).toBe(2);
  // Un trazo rápido: tinta (presión según la velocidad y puntas afinadas).
  await drag(page, { x: c.x - 200, y: c.y + 140 }, { x: c.x + 200, y: c.y + 150 }, 8);
  await expect.poll(() => itemCount(page)).toBe(3);
  // Sin formas rápidas, mantener quieto no convierte.
  await page.getByRole('button', { name: 'Ayudas' }).click();
  await page.getByRole('checkbox', { name: 'Formas rápidas' }).uncheck();
  await page.keyboard.press('Escape');
  await circle(c.x, c.y, true);
  await expect.poll(() => itemCount(page)).toBe(4);

  const p = await saveAndRead(app, page, file);
  const [snapped, free, ink, noSnap] = strokes(p);
  const radii = (pts: number[]) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < pts.length - 4; i += 4) {
      xs.push(pts[i]!);
      ys.push(pts[i + 1]!);
    }
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    const r = xs.map((x, i) => Math.hypot(x - cx, ys[i]! - cy));
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    return Math.max(...r.map((v) => Math.abs(v - mean))) / mean;
  };
  expect(snapped!.style.streamline).toBe(0.1);
  expect(radii(snapped!.points)).toBeLessThan(0.01);
  expect(snapped!.style.taper).toBeUndefined();
  expect(free!.style.streamline).not.toBe(0.1);
  expect(noSnap!.style.streamline).not.toBe(0.1);
  expect(ink!.style.taper).toBeGreaterThan(0);
  expect(ink!.points.filter((_, i) => i % 4 === 2).every((v) => v > 0 && v <= 1)).toBe(true);
  await stubMessageBox(app, 1);
  await app.close();
});

/** Dibuja con el ratón un lazo cerrado (o abierto `gap` radianes a la derecha). */
async function loop(page: import('@playwright/test').Page, c: { x: number; y: number }, r: number, gap = 0) {
  const steps = 48;
  const a0 = gap / 2;
  const a1 = Math.PI * 2 - gap / 2;
  const at = (k: number) => {
    const a = a0 + ((a1 - a0) * k) / steps;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  };
  await page.mouse.move(at(0).x, at(0).y);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) await page.mouse.move(at(k).x, at(k).y);
  if (!gap) await page.mouse.move(at(0).x + 2, at(0).y + 2); // se solapa al cerrar, como a mano
  await page.mouse.up();
}

/** Color [r, g, b] del lienzo de la escena en un punto de la pantalla. */
async function pixel(page: import('@playwright/test').Page, p: { x: number; y: number }) {
  return page.evaluate(({ x, y }) => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"]')!;
    const b = c.getBoundingClientRect();
    const k = c.width / b.width;
    const d = c.getContext('2d')!.getImageData(Math.round((x - b.left) * k), Math.round((y - b.top) * k), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, p);
}

test('bote de pintura: rellena un dibujo cerrado debajo de su línea y cierra huecos pequeños', async () => {
  const file = path.join(await tempDir(), 'relleno.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Relleno');
  const c = await center(page);
  const left = { x: c.x - 110, y: c.y };
  const right = { x: c.x + 110, y: c.y };
  await loop(page, left, 70);
  await loop(page, right, 70, 0.12); // con un hueco pequeño

  await page.keyboard.press('g');
  await expect(page.getByRole('toolbar', { name: 'Opciones de Bote de pintura' })).toBeVisible();
  // Sobre la línea no rellena: avisa.
  await page.mouse.click(left.x + 70, left.y);
  await expect(page.getByText('no sobre la línea')).toBeVisible();
  await page.mouse.click(left.x, left.y);
  await page.mouse.click(right.x, right.y);
  await expect.poll(() => pixel(page, left)).toEqual([0xe0, 0xa5, 0x26]);
  expect(await pixel(page, right)).toEqual([0xe0, 0xa5, 0x26]);
  // Fuera de los dibujos sigue el papel (el hueco no ha dejado escapar el relleno).
  expect(await pixel(page, { x: c.x, y: c.y - 120 })).not.toEqual([0xe0, 0xa5, 0x26]);

  // Sobre un relleno, cambia su color.
  await page.getByRole('group', { name: 'Color' }).getByRole('button', { name: 'Color #2f6fd6' }).click();
  await page.mouse.click(left.x, left.y);
  await expect.poll(() => pixel(page, left)).toEqual([0x2f, 0x6f, 0xd6]);

  const p: Project = await saveAndRead(app, page, file);
  const items = p.scenes[0]!.layers[0]!.items!;
  // Cada relleno queda justo debajo de su línea y aparece cuando ella termina de dibujarse.
  expect(items.map((i) => i.type)).toEqual(['shape', 'stroke', 'shape', 'stroke']);
  const [fillA, lineA, fillB, lineB] = items;
  if (fillA?.type !== 'shape' || fillB?.type !== 'shape' || !lineA || !lineB) throw new Error('orden inesperado');
  expect(fillA.shape).toBe('polygon');
  expect(fillA.style.fill).toBe('#2f6fd6');
  expect(fillB.style.fill).toBe('#e0a526');
  expect(fillA.in).toBe(lineA.in + lineA.enter!.duration);
  expect(fillB.in).toBe(lineB.in + lineB.enter!.duration);
  expect(fillA.enter?.kind).toBe('fade');
  await stubMessageBox(app, 1);
  await app.close();
});

test('dibujo en espejo: la copia reflejada se crea a la vez y se dibuja al mismo tiempo', async () => {
  const file = path.join(await tempDir(), 'espejo.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Espejo');
  const c = await center(page);
  await page.getByRole('button', { name: 'Ayudas' }).click();
  await page.getByRole('radiogroup', { name: 'Espejo' }).getByText('Izquierda y derecha').click();
  await page.keyboard.press('Escape');
  await drag(page, { x: c.x - 200, y: c.y - 60 }, { x: c.x - 60, y: c.y + 40 }, 10);
  await expect.poll(() => itemCount(page)).toBe(2);
  // Un solo paso de deshacer quita las dos.
  await page.keyboard.press('Control+z');
  await expect.poll(() => itemCount(page)).toBe(0);
  await page.keyboard.press('Control+y');
  await expect.poll(() => itemCount(page)).toBe(2);

  const p = await saveAndRead(app, page, file);
  const [a, b] = p.scenes[0]!.layers[0]!.items!;
  if (a?.type !== 'stroke' || b?.type !== 'stroke') throw new Error('se esperaban dos trazos');
  const W = p.settings.width;
  for (let i = 0; i < a.points.length; i += 4) {
    expect(b.points[i]).toBeCloseTo(W - a.points[i]!, 6);
    expect(b.points[i + 1]).toBe(a.points[i + 1]);
  }
  expect(b.in).toBe(a.in);
  expect(b.enter).toEqual(a.enter);
  await stubMessageBox(app, 1);
  await app.close();
});

import { expect, test, type Page } from '@playwright/test';
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

const PX_PER_SECOND = 80; // zoom inicial de la línea de tiempo

async function scrubTo(page: Page, seconds: number) {
  const b = (await page.getByTestId('timeline-scroll').boundingBox())!;
  await page.mouse.click(b.x + seconds * PX_PER_SECOND + 1, b.y + 10);
}

const items = (p: Project, scene = 0) => p.scenes[scene]!.layers.flatMap((l) => l.items ?? []);

test('lo dibujado aparece en secuencia y la vista previa muestra el instante', async () => {
  const file = path.join(await tempDir(), 'secuencia.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Secuencia');
  const c = await center(page);
  await drag(page, { x: c.x - 200, y: c.y - 60 }, { x: c.x + 200, y: c.y - 60 }, 20);
  await drag(page, { x: c.x - 200, y: c.y + 60 }, { x: c.x + 200, y: c.y + 60 }, 20);
  await expect(page.getByTestId('timeline-bar')).toHaveCount(2);

  const p = await saveAndRead(app, page, file);
  const [a, b] = items(p);
  expect(a!.in).toBe(0);
  expect(a!.enter?.kind).toBe('draw');
  expect(b!.in).toBe(a!.in + a!.enter!.duration);

  const editHash = await sceneHash(page);
  await scrubTo(page, 0.05);
  await expect(page.getByRole('button', { name: 'Vista previa' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => sceneHash(page)).not.toBe(editHash);
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect.poll(() => sceneHash(page)).toBe(editHash);
  await stubMessageBox(app, 1);
  await app.close();
});

test('grabar movimiento crea keyframes al mover en otro instante', async () => {
  const file = path.join(await tempDir(), 'keyframes.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Keyframes');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 60, y: c.y - 40 }, { x: c.x + 60, y: c.y + 40 }, 4);
  await page.getByRole('button', { name: 'Grabar movimiento' }).click();
  await scrubTo(page, 3);
  await expect(page.getByTestId('timeline-time')).toContainText('00:03:00');
  // Al tocar el lienzo se sale de la vista previa y se mueve la forma en el instante del cabezal.
  await drag(page, { x: c.x - 30, y: c.y + 40 }, { x: c.x + 120, y: c.y + 40 });
  const p = await saveAndRead(app, page, file);
  const x = items(p)[0]!.transform.x;
  expect('keys' in x && x.keys.length).toBe(2);
  await expect(page.getByRole('button', { name: /^Keyframe en / })).toHaveCount(2);
  await stubMessageBox(app, 1);
  await app.close();
});

test('escenas: añadir, dibujar en cada una y cambiar entre ellas', async () => {
  const file = path.join(await tempDir(), 'escenas.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Escenas');
  await page.getByRole('button', { name: 'Nueva escena' }).click();
  await expect(page.getByRole('tab', { name: 'Escena 2' })).toHaveAttribute('aria-selected', 'true');
  const c = await center(page);
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await expect.poll(() => itemCount(page)).toBe(1);
  await page.getByRole('tab', { name: 'Escena 1' }).click();
  await expect.poll(() => itemCount(page)).toBe(0);
  const p = await saveAndRead(app, page, file);
  expect(p.scenes.map((s) => s.name)).toEqual(['Escena 1', 'Escena 2']);
  expect(items(p, 1)).toHaveLength(1);
  await stubMessageBox(app, 1);
  await app.close();
});

test('capa de fotogramas: un dibujo por fotograma', async () => {
  const file = path.join(await tempDir(), 'fotogramas.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Fotogramas');
  await page.getByRole('button', { name: 'Nueva capa de fotogramas' }).click();
  const c = await center(page);
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await page.getByRole('button', { name: 'Fotograma', exact: true }).click();
  await expect(page.getByTestId('timeline-time')).toContainText('00:00:02');
  await drag(page, { x: c.x - 100, y: c.y + 40 }, { x: c.x + 100, y: c.y + 40 });
  const p = await saveAndRead(app, page, file);
  const frames = p.scenes[0]!.layers.find((l) => l.kind === 'frames')!;
  expect(frames.cels!.map((cel) => cel.items.length)).toEqual([1, 1]);
  expect(frames.cels![1]!.start).toBe(frames.cels![0]!.start + frames.cels![0]!.duration);
  await stubMessageBox(app, 1);
  await app.close();
});

test('reproducir avanza el cabezal y pausa lo detiene', async () => {
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Reproducir');
  const c = await center(page);
  await drag(page, { x: c.x - 100, y: c.y }, { x: c.x + 100, y: c.y });
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await expect(page.getByTestId('timeline-time')).not.toContainText('00:00:00 /', { timeout: 3000 });
  await page.getByRole('button', { name: 'Pausa' }).click();
  const t1 = await page.getByTestId('timeline-time').textContent();
  await page.waitForTimeout(400);
  expect(await page.getByTestId('timeline-time').textContent()).toBe(t1);
  await stubMessageBox(app, 1);
  await app.close();
});

test('animaciones rápidas de un clic y suavizado del movimiento', async () => {
  const file = path.join(await tempDir(), 'rapidas.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Rápidas');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 40, y: c.y - 30 }, { x: c.x + 40, y: c.y + 30 }, 4);
  const quick = page.getByRole('group', { name: 'Animaciones rápidas' });
  await quick.getByRole('button', { name: /^Saltar/ }).click();
  // Los keyframes aparecen en la línea de tiempo (rombos de la selección).
  await expect(page.getByRole('button', { name: /^Keyframe en/ }).first()).toBeVisible();

  await quick.getByRole('radio', { name: 'Derecha' }).click();
  await quick.getByRole('button', { name: /^Entrar/ }).click();
  await page.getByLabel('Suavizado del movimiento').selectOption({ label: 'Rebote' });

  const p = await saveAndRead(app, page, file);
  const shape = items(p)[0]!;
  const xs = shape.transform.x;
  const ys = shape.transform.y;
  expect('keys' in xs && xs.keys[0]!.v).toBeGreaterThan(1920); // entra desde fuera por la derecha
  expect('keys' in ys && ys.keys.length).toBeGreaterThan(2); // el salto
  expect('keys' in xs && xs.keys.every((k) => k.ease === 'bounce')).toBe(true);
  await stubMessageBox(app, 1);
  await app.close();
});

test('animar arrastrando graba el recorrido mientras avanza el vídeo', async () => {
  const file = path.join(await tempDir(), 'arrastrar.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Arrastrar');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 40, y: c.y - 30 }, { x: c.x + 40, y: c.y + 30 }, 4);
  const toggle = page.getByRole('button', { name: 'Animar arrastrando' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const keys = page.getByRole('button', { name: /^Keyframe en / });

  // Esc cancela: no se guarda nada y el cabezal vuelve a donde estaba.
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y, { steps: 3 });
  await expect(page.getByTestId('timeline-time')).not.toContainText('00:00:00 /');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('timeline-time')).toContainText('00:00:00 /');
  await expect(keys).toHaveCount(0);

  // Recorrido en L mientras se reproduce la escena.
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(c.x + i * 20, c.y);
    await page.waitForTimeout(70);
  }
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(c.x + 160, c.y + i * 12);
    await page.waitForTimeout(70);
  }
  await page.mouse.up();
  // El cabezal queda al final de lo grabado, para seguir desde ahí.
  await expect(page.getByTestId('timeline-time')).not.toContainText('00:00:00 /');
  expect(await keys.count()).toBeGreaterThanOrEqual(3);

  const p = await saveAndRead(app, page, file);
  const { x, y } = items(p)[0]!.transform;
  if (!('keys' in x) || !('keys' in y)) throw new Error('la posición debería estar animada');
  expect(x.keys[0]!.t).toBe(0);
  expect(x.keys[x.keys.length - 1]!.v - x.keys[0]!.v).toBeGreaterThan(200);
  expect(y.keys[y.keys.length - 1]!.v - y.keys[0]!.v).toBeGreaterThan(150);
  // Se deshace de una vez.
  await page.keyboard.press('Control+z');
  await expect(keys).toHaveCount(0);
  await stubMessageBox(app, 1);
  await app.close();
});

test('trazo vivo: en la vista previa las líneas tiemblan aunque nada se mueva', async () => {
  const file = path.join(await tempDir(), 'trazo-vivo.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Trazo vivo');
  const c = await center(page);
  await drag(page, { x: c.x - 200, y: c.y }, { x: c.x + 200, y: c.y + 40 }, 20);

  // Activado por defecto: entre dos instantes (ya dibujado y quieto) cambia el dibujo.
  await expect(page.getByRole('button', { name: 'Trazo vivo: Normal' })).toBeVisible();
  await scrubTo(page, 4);
  const a = await sceneHash(page);
  await scrubTo(page, 4.2);
  await expect.poll(() => sceneHash(page)).not.toBe(a);

  // Quieto: el mismo dibujo en ambos instantes.
  await page.getByRole('button', { name: 'Trazo vivo: Normal' }).click();
  await page.getByRole('radio', { name: 'Quieto' }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Trazo vivo: Quieto' })).toBeVisible();
  await scrubTo(page, 4);
  const b = await sceneHash(page);
  await scrubTo(page, 4.2);
  await page.waitForTimeout(100);
  expect(await sceneHash(page)).toBe(b);

  const p = await saveAndRead(app, page, file);
  expect(p.settings.boil).toBe('off');
  await stubMessageBox(app, 1);
  await app.close();
});

test('vida automática: el elemento se mueve solo al reproducir, sin keyframes', async () => {
  const file = path.join(await tempDir(), 'vida.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Vida');
  // Sin trazo vivo, para que solo cuente la vida automática.
  await page.getByRole('button', { name: 'Trazo vivo: Normal' }).click();
  await page.getByRole('radio', { name: 'Quieto' }).check();
  await page.keyboard.press('Escape');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 50, y: c.y - 40 }, { x: c.x + 50, y: c.y + 40 }, 4);

  const life = page.getByLabel('Vida automática');
  await expect(life).toHaveValue('');
  await scrubTo(page, 3);
  const still = await sceneHash(page);
  await scrubTo(page, 3.5);
  await page.waitForTimeout(100);
  expect(await sceneHash(page)).toBe(still);

  await page.getByRole('button', { name: 'Vista previa' }).click(); // vuelve a edición para ver el panel
  await life.selectOption({ label: 'Flotar' });
  await page.getByLabel('Intensidad de la vida').selectOption({ label: 'Marcado' });
  await scrubTo(page, 3);
  const a = await sceneHash(page);
  await scrubTo(page, 3.5);
  await expect.poll(() => sceneHash(page)).not.toBe(a);
  // No crea keyframes.
  await expect(page.getByRole('button', { name: /^Keyframe en / })).toHaveCount(0);

  const p = await saveAndRead(app, page, file);
  expect(items(p)[0]!.life).toEqual({ kind: 'float', amount: 1.7 });
  await stubMessageBox(app, 1);
  await app.close();
});

test('elasticidad del proyecto y estela de un elemento', async () => {
  const file = path.join(await tempDir(), 'elastico.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Elástico');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 40, y: c.y - 30 }, { x: c.x + 40, y: c.y + 30 }, 4);
  await page.getByRole('checkbox', { name: 'Estela al moverse' }).check();
  await page.getByRole('button', { name: 'Elasticidad: Normal' }).click();
  await page.getByRole('radio', { name: 'Marcado' }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Elasticidad: Marcado' })).toBeVisible();
  const p = await saveAndRead(app, page, file);
  expect(p.settings.elastic).toBe('strong');
  expect(items(p)[0]!.trail).toBe(true);
  await stubMessageBox(app, 1);
  await app.close();
});

test('transición de fundido entre escenas en la vista previa', async () => {
  const file = path.join(await tempDir(), 'transicion.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Transición', 'Guiado');
  await page.getByRole('button', { name: 'Trazo vivo: Normal' }).click();
  await page.getByRole('radio', { name: 'Quieto' }).check();
  await page.keyboard.press('Escape');
  // Escena 1: una casa grande en el centro. Escena 2: vacía, entra con fundido lento.
  await page.getByRole('button', { name: 'Añadir Casa' }).click();
  await page.getByRole('button', { name: 'Nueva escena' }).click();
  await page.getByRole('button', { name: /^Transición de entrada/ }).click();
  await page.getByRole('radio', { name: 'Fundido', exact: true }).check();
  await page.locator('label', { hasText: 'Lenta' }).click();
  await expect(page.getByRole('radio', { name: 'Lenta' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Transición de entrada: Fundido' })).toBeVisible();

  /** Color del centro del lienzo con el cabezal en `seconds` de la escena actual. */
  const centerAt = async (seconds: number) => {
    await scrubTo(page, seconds);
    await page.waitForTimeout(150);
    return page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"]')!;
      const d = c.getContext('2d')!.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
      return d[0]! + d[1]! + d[2]!;
    });
  };
  const end = await centerAt(4); // ya ha entrado: la escena 2, vacía (blanco)
  const mid = await centerAt(0.75); // a mitad del fundido: mezcla
  expect(end).toBe(255 * 3);
  expect(mid).toBeLessThan(end - 20);

  const p = await saveAndRead(app, page, file);
  expect(p.scenes[1]!.transition).toEqual({ kind: 'fade', duration: Math.round(1.5 * 705_600_000) });
  await stubMessageBox(app, 1);
  await app.close();
});

test('ritmo: aparecer uno en cada golpe, ajustar al compás y cámara que late', async () => {
  const file = path.join(await tempDir(), 'sincronia.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Sincronía');
  const c = await center(page);
  // Tres formas, de derecha a izquierda (aparecerán de izquierda a derecha).
  for (const dx of [150, 0, -150]) {
    await page.keyboard.press('r');
    await drag(page, { x: c.x + dx - 30, y: c.y - 30 }, { x: c.x + dx + 30, y: c.y + 30 }, 4);
  }
  await page.keyboard.press('Control+a');
  await page.getByRole('button', { name: 'Ritmo', exact: true }).click();
  await page.getByRole('button', { name: 'Uno en cada golpe' }).click();
  await page.getByRole('button', { name: 'Ritmo', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Cámara que late con el compás' }).check();
  await page.getByRole('button', { name: 'Ajustar el final al compás' }).click();

  const p = await saveAndRead(app, page, file);
  const shapes = items(p).sort((a, b) => a.in - b.in);
  // Sin música: 120 BPM, un golpe cada medio segundo desde el cabezal (0 s).
  expect(shapes.map((s) => s.in / 705_600_000)).toEqual([0, 0.5, 1]);
  const xs = shapes.map((s) => ('value' in s.transform.x ? s.transform.x.value : 0));
  expect(xs[0]).toBeLessThan(xs[1]!);
  expect(xs[1]).toBeLessThan(xs[2]!);
  expect(p.scenes[0]!.beatPulse).toBe(true);
  expect((p.scenes[0]!.duration / 705_600_000) % 2).toBe(0);
  await stubMessageBox(app, 1);
  await app.close();
});

test('texto para letras de canción: una palabra en cada golpe', async () => {
  const file = path.join(await tempDir(), 'letra.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Letra');
  const c = await center(page);
  await page.keyboard.press('t');
  await page.mouse.click(c.x - 150, c.y);
  await page.keyboard.type('canta conmigo esta noche');
  await page.keyboard.press('Escape');
  await expect.poll(() => itemCount(page)).toBe(1);
  await page.keyboard.press('v');
  await page.keyboard.press('Control+a');
  await page.getByLabel('Cómo se escribe el texto').selectOption({ label: 'Una palabra en cada golpe' });

  // Sin música, 120 BPM: a los 0,6 s se ven dos palabras y a los 2 s, todas.
  await scrubTo(page, 0.6);
  const two = await sceneHash(page);
  await scrubTo(page, 2);
  await expect.poll(() => sceneHash(page)).not.toBe(two);

  const p = await saveAndRead(app, page, file);
  expect(items(p)[0]).toMatchObject({ type: 'text', reveal: 'beat-words', enter: { kind: 'draw' } });
  await stubMessageBox(app, 1);
  await app.close();
});

test('repetir movimiento: un salto que se repite sigue moviéndose', async () => {
  const file = path.join(await tempDir(), 'bucle.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Bucle');
  await page.getByRole('button', { name: 'Trazo vivo: Normal' }).click();
  await page.getByRole('radio', { name: 'Quieto' }).check();
  await page.keyboard.press('Escape');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 40, y: c.y - 30 }, { x: c.x + 40, y: c.y + 30 }, 4);
  await page
    .getByRole('group', { name: 'Animaciones rápidas' })
    .getByRole('button', { name: /^Saltar/ })
    .click();

  // Sin repetir: pasado el salto, quieto.
  await scrubTo(page, 2);
  const a = await sceneHash(page);
  await scrubTo(page, 2.3);
  await page.waitForTimeout(100);
  expect(await sceneHash(page)).toBe(a);

  await page.getByRole('button', { name: 'Vista previa' }).click();
  await page.getByLabel('Al terminar el movimiento').selectOption({ label: 'Se repite' });
  await scrubTo(page, 2);
  const b = await sceneHash(page);
  await scrubTo(page, 2.3);
  await expect.poll(() => sceneHash(page)).not.toBe(b);

  const p = await saveAndRead(app, page, file);
  expect(items(p)[0]!.loop).toBe('repeat');
  await stubMessageBox(app, 1);
  await app.close();
});

test('mano que dibuja: activa en los proyectos nuevos y se puede cambiar', async () => {
  const file = path.join(await tempDir(), 'mano.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Mano');
  const c = await center(page);
  await drag(page, { x: c.x - 150, y: c.y }, { x: c.x + 150, y: c.y + 30 }, 20);
  // A mitad del dibujo, con mano y sin ella, el fotograma es distinto.
  await scrubTo(page, 0.4);
  const withHand = await sceneHash(page);
  await page.getByRole('button', { name: 'Trazo vivo: Normal' }).click();
  await expect(page.getByRole('radio', { name: 'Mano con rotulador' })).toBeChecked();
  await page.getByRole('radio', { name: 'Sin mano' }).check();
  await page.keyboard.press('Escape');
  await expect.poll(() => sceneHash(page)).not.toBe(withHand);
  await page.getByRole('button', { name: 'Trazo vivo: Normal' }).click();
  await page.getByRole('radio', { name: 'Mano con lápiz' }).check();
  await page.keyboard.press('Escape');
  const p = await saveAndRead(app, page, file);
  expect(p.settings.hand).toBe('pencil');
  await stubMessageBox(app, 1);
  await app.close();
});

test('tipo de hoja: cuaderno de rayas al editar y en el proyecto', async () => {
  const file = path.join(await tempDir(), 'hoja.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Hoja');
  const plain = await sceneHash(page);
  await page.getByRole('button', { name: 'Trazo vivo: Normal' }).click();
  await page.getByLabel('Tipo de hoja').selectOption({ label: 'Cuaderno de rayas' });
  await page.keyboard.press('Escape');
  await expect.poll(() => sceneHash(page)).not.toBe(plain);
  const p = await saveAndRead(app, page, file);
  expect(p.settings.paper).toBe('notebook');
  await stubMessageBox(app, 1);
  await app.close();
});

test('la cámara sigue a un elemento', async () => {
  const file = path.join(await tempDir(), 'sigue.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Sigue');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 40, y: c.y - 30 }, { x: c.x + 40, y: c.y + 30 }, 4);
  await scrubTo(page, 2);
  const plain = await sceneHash(page);
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await page.getByRole('button', { name: 'Seguir con la cámara' }).click();
  await page.getByLabel('Distancia de la cámara').selectOption({ label: 'La cámara lo sigue · cerca' });
  // En la vista previa el encuadre se acerca al elemento.
  await scrubTo(page, 2);
  await expect.poll(() => sceneHash(page)).not.toBe(plain);
  // Con la herramienta de cámara se avisa de que el encuadre manual no se aplica.
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await page.keyboard.press('c');
  await expect(page.getByText(/La cámara sigue a/)).toBeVisible();
  const p = await saveAndRead(app, page, file);
  expect(p.scenes[0]!.follow).toEqual({ id: items(p)[0]!.id, zoom: 2.2 });
  await stubMessageBox(app, 1);
  await app.close();
});

test('copiar la animación de un elemento y pegarla en otro', async () => {
  const file = path.join(await tempDir(), 'copiar.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Copiar');
  const c = await center(page);
  await page.keyboard.press('r');
  await drag(page, { x: c.x - 200, y: c.y - 30 }, { x: c.x - 120, y: c.y + 30 }, 4);
  const quick = page.getByRole('group', { name: 'Animaciones rápidas' });
  await quick.getByRole('button', { name: /^Saltar/ }).click();
  await page.getByRole('button', { name: 'Copiar animación' }).click();
  await expect(page.getByText(/Animación de «.+» copiada/)).toBeVisible();

  // Un segundo elemento (queda seleccionado al crearlo) recibe el mismo salto desde donde está.
  await page.keyboard.press('r');
  await drag(page, { x: c.x + 120, y: c.y + 20 }, { x: c.x + 200, y: c.y + 90 }, 4);
  await page.getByRole('button', { name: 'Pegar animación' }).click();

  const p = await saveAndRead(app, page, file);
  const [a, b] = items(p);
  const ya = a!.transform.y;
  const yb = b!.transform.y;
  if (!('keys' in ya) || !('keys' in yb)) throw new Error('se esperaban keyframes en los dos');
  expect(yb.keys).toHaveLength(ya.keys.length);
  yb.keys.forEach((k, i) => {
    expect(k.t - b!.in).toBe(ya.keys[i]!.t - a!.in);
    expect(k.v - yb.keys[0]!.v).toBeCloseTo(ya.keys[i]!.v - ya.keys[0]!.v, 6);
    expect(k.ease).toBe(ya.keys[i]!.ease);
  });
  expect(yb.keys[0]!.v).not.toBeCloseTo(ya.keys[0]!.v, 0); // cada uno salta desde su sitio
  await stubMessageBox(app, 1);
  await app.close();
});

test('color de fondo por escena y para todas', async () => {
  const file = path.join(await tempDir(), 'fondos.dwings');
  const { app, page } = await launch(await tempDir());
  await newFreeProject(page, 'Fondos');
  const c = await center(page);
  const pixel = () =>
    page.evaluate(({ x, y }) => {
      const cv = document.querySelector<HTMLCanvasElement>('[data-testid="scene-canvas"]')!;
      const b = cv.getBoundingClientRect();
      const k = cv.width / b.width;
      const d = cv.getContext('2d')!.getImageData(Math.round((x - b.left) * k), Math.round((y - b.top) * k), 1, 1).data;
      return `#${[d[0], d[1], d[2]].map((v) => v!.toString(16).padStart(2, '0')).join('')}`;
    }, c);

  await page.getByRole('button', { name: 'Fondo de la escena' }).click();
  await page.getByRole('group', { name: 'Fondo' }).getByRole('button', { name: 'Color #fde2e4' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(pixel).toBe('#fde2e4');

  // Una escena nueva tiene el fondo del proyecto (blanco)…
  await page.getByRole('button', { name: 'Nueva escena' }).click();
  await expect.poll(pixel).toBe('#ffffff');
  // …hasta usar el rosa en todas.
  await page.getByRole('tab', { name: 'Escena 1' }).click();
  await page.getByRole('button', { name: 'Fondo de la escena' }).click();
  await page.getByRole('button', { name: 'Usar en todas las escenas' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Escena 2' }).click();
  await expect.poll(pixel).toBe('#fde2e4');

  const p = await saveAndRead(app, page, file);
  expect(p.settings.background).toBe('#fde2e4');
  expect(p.scenes.every((s) => s.background === undefined)).toBe(true);
  await stubMessageBox(app, 1);
  await app.close();
});

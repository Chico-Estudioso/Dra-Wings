import { test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createProject, createStroke } from '../../src/core/model/factory';
import { appendTiming, fitSceneDuration } from '../../src/core/anim/timing';
import { encodeProject } from '../../src/main/project-file';
import { launch, stubMessageBox, stubOpenDialog, tempDir } from './helpers';

function stressProject(n: number) {
  const p = createProject({ name: 'Estrés', aspect: 'landscape', fps: 30, mode: 'free' });
  const scene = p.scenes[0]!;
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const pts: number[] = [];
    let x = rnd() * 1800 + 60,
      y = rnd() * 960 + 60;
    for (let k = 0; k < 40; k++) {
      x += (rnd() - 0.5) * 30;
      y += (rnd() - 0.5) * 30;
      pts.push(x, y, 0.5, k * 16);
    }
    const s = createStroke(pts, { color: '#1d1d1f', size: 6, opacity: 1 });
    appendTiming(scene, s);
    scene.layers[0]!.items!.push(s);
  }
  fitSceneDuration(scene);
  return p;
}

// Medición de rendimiento con proyectos grandes. No forma parte de la CI: se ejecuta a mano con
// DW_PERF=1 npx playwright test tests/e2e/perf.spec.ts (resultados en docs/TESTING_STRATEGY.md).
test.skip(!process.env.DW_PERF, 'Solo con DW_PERF=1');

for (const n of [300, 2000]) {
  test(`perf ${n}`, async () => {
    test.setTimeout(180_000);
    const dir = await tempDir();
    const file = path.join(dir, `estres-${n}.dwings`);
    await writeFile(file, encodeProject(stressProject(n), 'test'));
    const { app, page } = await launch(await tempDir());
    await stubOpenDialog(app, file);
    const t0 = Date.now();
    await page.getByRole('button', { name: /Abrir proyecto/ }).click();
    await page.getByTestId('overlay-canvas').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="timeline-bar"]').length > 0);
    const openMs = Date.now() - t0;
    const stats = await page.evaluate(async () => {
      const longs: number[] = [];
      const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => longs.push(e.duration)));
      po.observe({ type: 'longtask', buffered: false });
      const frames: number[] = [];
      let last = performance.now();
      const btn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Reproducir')!;
      btn.click();
      await new Promise<void>((resolve) => {
        const end = performance.now() + 3000;
        const tick = () => {
          const now = performance.now();
          frames.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      (
        [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Pausa') as
          HTMLButtonElement | undefined
      )?.click();
      po.disconnect();
      frames.sort((a, b) => a - b);
      return {
        frames: frames.length,
        p50: frames[Math.floor(frames.length / 2)]!.toFixed(1),
        p95: frames[Math.floor(frames.length * 0.95)]!.toFixed(1),
        max: frames[frames.length - 1]!.toFixed(1),
        longTasks: longs.length,
        longMax: Math.max(0, ...longs).toFixed(0),
      };
    });
    console.log(`PERF n=${n} open=${openMs}ms`, JSON.stringify(stats));
    // Edición con todo visible: desplazar la vista obliga a redibujar la escena entera.
    const host = (await page.getByTestId('overlay-canvas').boundingBox())!;
    await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2);
    const pan = await page.evaluate(async () => {
      const frames: number[] = [];
      let last = performance.now();
      let running = true;
      const tick = () => {
        const now = performance.now();
        frames.push(now - last);
        last = now;
        if (running) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const el = document.querySelector('[data-testid="overlay-canvas"]')!;
      for (let i = 0; i < 60; i++) {
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: 20, bubbles: true, cancelable: true }));
        await new Promise((r) => requestAnimationFrame(r));
      }
      running = false;
      frames.sort((a, b) => a - b);
      return {
        p50: frames[Math.floor(frames.length / 2)]!.toFixed(1),
        p95: frames[Math.floor(frames.length * 0.95)]!.toFixed(1),
        max: frames[frames.length - 1]!.toFixed(1),
      };
    });
    console.log(`PAN n=${n}`, JSON.stringify(pan));
    // Vista previa al final (todo dibujado) mientras se arrastra el cabezal.
    const scrub = await page.evaluate(async () => {
      const sc = document.querySelector('[data-testid="timeline-scroll"]') as HTMLElement;
      sc.scrollLeft = sc.scrollWidth;
      const r = sc.getBoundingClientRect();
      const times: number[] = [];
      for (let i = 0; i < 30; i++) {
        const t0 = performance.now();
        const x = r.right - 130 - i;
        sc.dispatchEvent(
          new PointerEvent('pointerdown', { clientX: x, clientY: r.top + 10, bubbles: true, button: 0, pointerId: 1 }),
        );
        sc.dispatchEvent(
          new PointerEvent('pointerup', { clientX: x, clientY: r.top + 10, bubbles: true, button: 0, pointerId: 1 }),
        );
        await new Promise((res) => requestAnimationFrame(() => setTimeout(res)));
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return { p50: times[15]!.toFixed(1), max: times[29]!.toFixed(1) };
    });
    console.log(`SCRUB n=${n}`, JSON.stringify(scrub));
    await stubMessageBox(app, 1);
    await app.close();
  });
}

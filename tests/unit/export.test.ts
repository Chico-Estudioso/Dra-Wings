import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defaultExportSettings, exportSize, frameTick, planExport } from '@core/export/plan';
import { createProject, createScene } from '@core/model/factory';
import { TICKS_PER_SECOND } from '@core/time/ticks';
import { checkPng, ExportError, ExportSessions, frameImageName, IMAGE_MAX_BYTES } from '../../src/main/export';

describe('plan de exportación', () => {
  it('el tamaño respeta la proporción de la hoja con lados pares', () => {
    expect(exportSize({ width: 1920, height: 1080 }, '720p')).toEqual({ width: 1280, height: 720 });
    expect(exportSize({ width: 1920, height: 1080 }, '1080p')).toEqual({ width: 1920, height: 1080 });
    expect(exportSize({ width: 1080, height: 1080 }, '720p')).toEqual({ width: 720, height: 720 });
    expect(exportSize({ width: 1080, height: 1920 }, '1080p')).toEqual({ width: 1080, height: 1920 });
    const odd = exportSize({ width: 1001, height: 999 }, '720p');
    expect(odd.width % 2).toBe(0);
    expect(odd.height).toBe(720);
  });

  it('cubre todas las escenas con fotogramas exactos', () => {
    const p = createProject({ name: 'V', aspect: 'landscape', fps: 30, mode: 'free' });
    p.scenes.push(createScene('Dos', 2.5));
    const plan = planExport(p, { resolution: '720p', fps: 24, quality: 'high' });
    expect(plan.duration).toBe(7.5 * TICKS_PER_SECOND);
    expect(plan.frames).toBe(180);
    expect(frameTick(24, 24)).toBe(TICKS_PER_SECOND);
    expect(defaultExportSettings(p)).toMatchObject({ resolution: '1080p', fps: 30 });
  });
});

describe('sesiones de exportación (proceso principal)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'dw-export-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('escribe por posiciones en un temporal y al terminar lo convierte en el vídeo', async () => {
    const target = path.join(dir, 'video.mp4');
    await writeFile(target, 'versión anterior');
    const s = new ExportSessions();
    const id = await s.begin(target);
    await s.write(id, 4, new Uint8Array([5, 6]));
    await s.write(id, 0, new Uint8Array([1, 2, 3, 4]));
    // Mientras tanto, el destino anterior sigue intacto.
    expect(await readFile(target, 'utf8')).toBe('versión anterior');
    expect(await s.finish(id)).toBe(target);
    expect([...(await readFile(target))]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await readdir(dir)).toEqual(['video.mp4']);
    expect(s.active).toBe(false);
  });

  it('cancelar borra el temporal y no toca el destino', async () => {
    const target = path.join(dir, 'video.mp4');
    const s = new ExportSessions();
    const id = await s.begin(target);
    await s.write(id, 0, new Uint8Array(10));
    await s.cancel(id);
    expect(await readdir(dir)).toEqual([]);
  });

  it('rechaza ids ajenos, datos no válidos y una segunda exportación simultánea', async () => {
    const s = new ExportSessions();
    const id = await s.begin(path.join(dir, 'a.mp4'));
    await expect(s.begin(path.join(dir, 'b.mp4'))).rejects.toBeInstanceOf(ExportError);
    await expect(s.write('otro', 0, new Uint8Array(1))).rejects.toBeInstanceOf(ExportError);
    await expect(s.write(id, -1, new Uint8Array(1))).rejects.toBeInstanceOf(ExportError);
    await expect(s.write(id, 0.5, new Uint8Array(1))).rejects.toBeInstanceOf(ExportError);
    await expect(s.write(id, 0, 'texto')).rejects.toBeInstanceOf(ExportError);
    await expect(s.finish('otro')).rejects.toBeInstanceOf(ExportError);
    await s.cancel('otro'); // no hace nada
    expect(s.active).toBe(true);
    await s.cancel(id);
  });
});

describe('fotograma como imagen (proceso principal)', () => {
  const png = (n = 64) => {
    const b = new Uint8Array(n);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return b;
  };

  it('solo acepta un PNG de tamaño razonable', () => {
    expect(checkPng(png())).toHaveLength(64);
    expect(() => checkPng('texto')).toThrow(ExportError);
    expect(() => checkPng(new Uint8Array(64))).toThrow(ExportError); // sin firma PNG
    expect(() => checkPng(png(8))).toThrow(ExportError); // truncado
    expect(() => checkPng(png(IMAGE_MAX_BYTES + 1))).toThrow(ExportError);
    const jpg = new Uint8Array(64);
    jpg.set([0xff, 0xd8, 0xff]);
    expect(() => checkPng(jpg)).toThrow(ExportError);
  });

  it('sugiere un nombre con el instante del fotograma', () => {
    expect(frameImageName('Mi historia', 72.9)).toBe('Mi historia 1m12s');
    expect(frameImageName('Mi historia', 0)).toBe('Mi historia 0m00s');
    expect(frameImageName('X', -5)).toBe('X 0m00s');
    expect(frameImageName('X', Number.NaN)).toBe('X 0m00s');
    expect(frameImageName('X', '12')).toBe('X 0m00s');
    expect(frameImageName('X', 1e12)).toBe('X 1440m00s');
  });
});

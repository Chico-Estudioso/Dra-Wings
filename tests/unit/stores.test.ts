import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProject } from '@core/model/factory';
import { RecoveryStore } from '../../src/main/recovery';
import { RecentStore } from '../../src/main/recent';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'dw-stores-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const project = (name = 'Historia') => createProject({ name, aspect: 'landscape', fps: 30, mode: 'guided' });

describe('RecoveryStore', () => {
  it('escribe, lista, lee y descarta', async () => {
    const store = new RecoveryStore(path.join(dir, 'recovery'));
    const p = project();
    await store.write(p, null);
    const list = await store.list();
    expect(list).toEqual([expect.objectContaining({ projectId: p.id, name: 'Historia', filePath: null })]);
    expect((await store.read(p.id)).project).toEqual(p);
    await store.discard(p.id);
    expect(await store.list()).toEqual([]);
  });

  it('oculta y limpia recuperaciones más antiguas que su archivo', async () => {
    const store = new RecoveryStore(path.join(dir, 'recovery'));
    const file = path.join(dir, 'a.dwings');
    await writeFile(file, 'x');
    const p = project();
    await store.write(p, file, new Date('2026-01-01T00:00:00Z'));
    await utimes(file, new Date('2026-01-02T00:00:00Z'), new Date('2026-01-02T00:00:00Z'));
    expect(await store.list()).toEqual([]);
  });

  it('mantiene recuperaciones más recientes que su archivo', async () => {
    const store = new RecoveryStore(path.join(dir, 'recovery'));
    const file = path.join(dir, 'b.dwings');
    await writeFile(file, 'x');
    await utimes(file, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
    const p = project();
    await store.write(p, file, new Date('2026-01-02T00:00:00Z'));
    expect(await store.list()).toHaveLength(1);
  });

  it('rechaza identificadores con rutas', async () => {
    const store = new RecoveryStore(path.join(dir, 'recovery'));
    await expect(store.discard('../../etc')).rejects.toThrow();
  });
});

describe('RecentStore', () => {
  it('ordena por uso, evita duplicados, limita y detecta archivos ausentes', async () => {
    const store = new RecentStore(path.join(dir, 'recent.json'));
    const existing = path.join(dir, 'existe.dwings');
    await writeFile(existing, 'x');
    for (let i = 0; i < 14; i++) await store.touch(path.join(dir, `p${i}.dwings`), `P${i}`);
    await store.touch(existing, 'Existe');
    await store.touch(path.join(dir, 'p13.dwings'), 'P13');
    const list = await store.list();
    expect(list).toHaveLength(12);
    expect(list[0]!.name).toBe('P13');
    expect(list[1]).toMatchObject({ name: 'Existe', exists: true });
    expect(list[0]!.exists).toBe(false);
    expect(await store.has(existing)).toBe(true);
    await store.remove(existing);
    expect(await store.has(existing)).toBe(false);
  });

  it('tolera un archivo de recientes dañado', async () => {
    const file = path.join(dir, 'recent.json');
    await writeFile(file, '{no es json');
    expect(await new RecentStore(file).list()).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { createProject } from '@core/model/factory';
import {
  ProjectFileError,
  decodeProject,
  encodeProject,
  readProjectFile,
  writeFileAtomic,
  writeProjectFile,
} from '../../src/main/project-file';

const project = () => createProject({ name: 'Prueba', aspect: 'landscape', fps: 30, mode: 'free' });
const manifest = (v = 1) => strToU8(JSON.stringify({ format: 'dra-wings', formatVersion: v, appVersion: 'test' }));

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ProjectFileError);
    expect((e as ProjectFileError).code).toBe(code);
    return e as ProjectFileError;
  }
  throw new Error(`Se esperaba ProjectFileError(${code})`);
}

describe('codificar y decodificar', () => {
  it('ida y vuelta conserva el proyecto', () => {
    const p = project();
    const r = decodeProject(encodeProject(p, '0.1.0'));
    expect(r.project).toEqual(p);
    expect(r.migrated).toBe(false);
  });

  it('rechaza archivos que no son ZIP', () => {
    expectCode(() => decodeProject(strToU8('hola, no soy un zip')), 'not-a-project');
  });

  it('rechaza ZIP sin manifiesto o sin documento', () => {
    expectCode(() => decodeProject(zipSync({ 'project.json': strToU8('{}') })), 'not-a-project');
    expectCode(() => decodeProject(zipSync({ 'manifest.json': manifest() })), 'not-a-project');
  });

  it('rechaza rutas peligrosas dentro del ZIP', () => {
    const bytes = zipSync({
      'manifest.json': manifest(),
      'project.json': strToU8(JSON.stringify(project())),
      '../fuera.txt': strToU8('x'),
    });
    expectCode(() => decodeProject(bytes), 'unsafe');
  });

  it('rechaza formatos de una versión futura con un mensaje claro', () => {
    const bytes = zipSync({ 'manifest.json': manifest(99), 'project.json': strToU8(JSON.stringify(project())) });
    const e = expectCode(() => decodeProject(bytes), 'newer-version');
    expect(e.message).toMatch(/Actualiza la aplicación/);
  });

  it('rechaza JSON dañado y datos inválidos con detalles', () => {
    expectCode(
      () => decodeProject(zipSync({ 'manifest.json': manifest(), 'project.json': strToU8('{roto') })),
      'corrupt',
    );
    const bad = { ...project(), settings: { ...project().settings, width: -5 } };
    const e = expectCode(
      () => decodeProject(zipSync({ 'manifest.json': manifest(), 'project.json': strToU8(JSON.stringify(bad)) })),
      'invalid',
    );
    expect(e.details.join('\n')).toMatch(/settings\.width/);
  });
});

describe('archivos en disco', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'dw-test-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('guarda, crea .bak con la versión anterior y vuelve a abrir', async () => {
    const file = path.join(dir, 'historia.dwings');
    const p1 = project();
    await writeProjectFile(file, p1, '0.1.0');
    const p2 = { ...p1, name: 'Renombrado' };
    await writeProjectFile(file, p2, '0.1.0');
    expect((await readProjectFile(file)).project.name).toBe('Renombrado');
    expect(decodeProject(await readFile(`${file}.bak`)).project.name).toBe('Prueba');
    expect((await readdir(dir)).sort()).toEqual(['historia.dwings', 'historia.dwings.bak']);
  });

  it('si el reemplazo falla, el original queda intacto y no quedan temporales', async () => {
    const target = path.join(dir, 'destino');
    await mkdir(target); // renombrar un archivo sobre un directorio falla
    await writeFile(path.join(target, 'dentro.txt'), 'original');
    await expect(writeFileAtomic(target, strToU8('nuevo'), { backup: false })).rejects.toThrow();
    expect(await readFile(path.join(target, 'dentro.txt'), 'utf8')).toBe('original');
    expect(await readdir(dir)).toEqual(['destino']);
  });

  it('informa de archivos inexistentes', async () => {
    await expect(readProjectFile(path.join(dir, 'no-existe.dwings'))).rejects.toMatchObject({ code: 'not-found' });
  });
});

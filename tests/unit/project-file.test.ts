import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { createImage, createProject } from '@core/model/factory';
import { MediaError, MediaStore, sha256, sniffMedia } from '../../src/main/media';
import { downmix, encodeWav, rms } from '@core/audio/wav';
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

describe('medios', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'dw-media-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // Firma PNG real seguida de bytes cualquiera: el almacén decide el tipo por la firma.
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4]);

  async function withImage() {
    const src = path.join(dir, 'Foto.PNG');
    await writeFile(src, PNG);
    const store = new MediaStore(path.join(dir, 'cache'));
    const m = await store.import(src, 'image');
    const p = project();
    const asset = { id: 'img1', hash: m.hash, mime: m.mime, name: m.name, size: m.size };
    p.assets.push(asset);
    p.scenes[0]!.layers[0]!.items!.push(createImage('img1', 0, 0, 8, 8));
    return { store, m, p };
  }

  it('importar copia por contenido y valida tipo y extensión', async () => {
    const { store, m } = await withImage();
    expect(m).toMatchObject({ hash: sha256(PNG), mime: 'image/png', name: 'Foto.PNG', kind: 'image' });
    expect(new Uint8Array(await store.read(`${m.hash}.png`))).toEqual(PNG);
    await writeFile(path.join(dir, 'nota.txt'), 'hola');
    await expect(store.import(path.join(dir, 'nota.txt'), 'image')).rejects.toBeInstanceOf(MediaError);
    await expect(store.import(path.join(dir, 'Foto.PNG'), 'audio')).rejects.toBeInstanceOf(MediaError);
    expect(() => store.pathOf('../../etc/passwd')).toThrow(MediaError);
  });

  it('el proyecto guarda sus medios y al abrirlo en otro equipo se extraen verificados', async () => {
    const { store, p, m } = await withImage();
    const file = path.join(dir, 'con-imagen.dwings');
    await writeProjectFile(file, p, '0.1.0', store);
    const other = new MediaStore(path.join(dir, 'otro-equipo'));
    const r = await readProjectFile(file, other);
    expect(r.missingMedia).toEqual([]);
    expect(new Uint8Array(await other.read(`${m.hash}.png`))).toEqual(PNG);
    expect(r.project).toEqual(p);
  });

  it('un medio manipulado se rechaza al abrir', async () => {
    const { p, m } = await withImage();
    const bytes = encodeProject(p, '0.1.0', { [`${m.hash}.png`]: new Uint8Array([9, 9, 9]) });
    const file = path.join(dir, 'manipulado.dwings');
    await writeFile(file, bytes);
    await expect(readProjectFile(file, new MediaStore(path.join(dir, 'c2')))).rejects.toMatchObject({
      code: 'corrupt',
    });
  });

  it('si falta un medio, se abre igualmente y se informa', async () => {
    const { p } = await withImage();
    const file = path.join(dir, 'incompleto.dwings');
    await writeFile(file, encodeProject(p, '0.1.0'));
    const r = await readProjectFile(file, new MediaStore(path.join(dir, 'vacia')));
    expect(r.missingMedia).toEqual(['Foto.PNG']);
  });

  it('no se puede guardar si un medio ya no está en la caché', async () => {
    const { p } = await withImage();
    const empty = new MediaStore(path.join(dir, 'sin-medios'));
    await expect(writeProjectFile(path.join(dir, 'x.dwings'), p, '0.1.0', empty)).rejects.toMatchObject({
      code: 'io',
    });
  });
});

describe('tipo real de los medios', () => {
  const bytes = (head: number[] | string, total = 32) => {
    const b = new Uint8Array(total);
    b.set(typeof head === 'string' ? [...head].map((c) => c.charCodeAt(0)) : head);
    return b;
  };

  it('reconoce cada formato por su firma, no por la extensión', () => {
    expect(sniffMedia(bytes([0x89, 0x50, 0x4e, 0x47]))?.mime).toBe('image/png');
    expect(sniffMedia(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg');
    expect(sniffMedia(bytes('GIF89a'))?.mime).toBe('image/gif');
    expect(sniffMedia(bytes('RIFF\0\0\0\0WEBPVP8 '))?.mime).toBe('image/webp');
    expect(sniffMedia(bytes('RIFF\0\0\0\0WAVEfmt '))?.mime).toBe('audio/wav');
    expect(sniffMedia(bytes('OggS'))?.mime).toBe('audio/ogg');
    expect(sniffMedia(bytes('fLaC'))?.mime).toBe('audio/flac');
    expect(sniffMedia(bytes('\0\0\0\x20ftypM4A '))?.mime).toBe('audio/mp4');
    expect(sniffMedia(bytes('ID3'))?.mime).toBe('audio/mpeg');
    expect(sniffMedia(bytes([0xff, 0xfb, 0x90]))?.mime).toBe('audio/mpeg'); // trama MP3 (capa III)
    expect(sniffMedia(bytes([0xff, 0xf1, 0x50]))?.mime).toBe('audio/aac'); // AAC en ADTS
    expect(sniffMedia(bytes('<html>'))).toBeNull();
    expect(sniffMedia(new Uint8Array(4))).toBeNull();
  });

  it('importar bytes guarda por contenido y rechaza lo que no es del tipo pedido', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'dw-bytes-'));
    try {
      const store = new MediaStore(dir);
      const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 48_000);
      const m = await store.importBytes(wav, 'audio', 'Narración\u0007.wav');
      expect(m).toMatchObject({ mime: 'audio/wav', name: 'Narración.wav', size: wav.byteLength, kind: 'audio' });
      expect(new Uint8Array(await store.read(`${m.hash}.wav`))).toEqual(wav);
      // Un «audio» que en realidad es una imagen, o al revés, no se acepta.
      await expect(store.importBytes(wav, 'image', 'x.png')).rejects.toBeInstanceOf(MediaError);
      await expect(store.importBytes(bytes('<script>'), 'audio', 'x.mp3')).rejects.toBeInstanceOf(MediaError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('WAV de las grabaciones', () => {
  it('codifica PCM de 16 bits mono con la cabecera correcta', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]), 48_000);
    const v = new DataView(wav.buffer);
    const text = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(v.getUint32(4, true)).toBe(36 + 8);
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(48_000);
    expect(v.getUint16(34, true)).toBe(16);
    // Muestras: 0, máximo, mínimo y una fuera de rango que se recorta.
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
    expect(sniffMedia(wav)?.mime).toBe('audio/wav');
  });

  it('mezcla a mono y mide el nivel', () => {
    expect([...downmix([new Float32Array([1, 0]), new Float32Array([0, 1])])]).toEqual([0.5, 0.5]);
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rms(new Float32Array())).toBe(0);
  });
});

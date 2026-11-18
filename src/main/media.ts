// Almacén de medios importados: caché por hash (SHA-256) en la carpeta de datos de la aplicación.
// Los medios se guardan dentro del `.dwings` al guardar y se extraen aquí al abrir.
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MEDIA_MAX_BYTES, MEDIA_NAME, mediaFileName } from '@shared/media';

export { MEDIA_NAME };

export type MediaKind = 'image' | 'audio';

type MediaType = { mime: string; kind: MediaKind; ext: string };

const PNG: MediaType = { mime: 'image/png', kind: 'image', ext: 'png' };
const JPG: MediaType = { mime: 'image/jpeg', kind: 'image', ext: 'jpg' };
const WEBP: MediaType = { mime: 'image/webp', kind: 'image', ext: 'webp' };
const GIF: MediaType = { mime: 'image/gif', kind: 'image', ext: 'gif' };
const MP3: MediaType = { mime: 'audio/mpeg', kind: 'audio', ext: 'mp3' };
const WAV: MediaType = { mime: 'audio/wav', kind: 'audio', ext: 'wav' };
const OGG: MediaType = { mime: 'audio/ogg', kind: 'audio', ext: 'ogg' };
const M4A: MediaType = { mime: 'audio/mp4', kind: 'audio', ext: 'm4a' };
const FLAC: MediaType = { mime: 'audio/flac', kind: 'audio', ext: 'flac' };
const AAC: MediaType = { mime: 'audio/aac', kind: 'audio', ext: 'aac' };

/** Extensiones admitidas en los diálogos de importación. */
export const MEDIA_TYPES: Record<string, MediaType> = {
  png: PNG,
  jpg: JPG,
  jpeg: JPG,
  webp: WEBP,
  gif: GIF,
  mp3: MP3,
  wav: WAV,
  ogg: OGG,
  opus: OGG,
  m4a: M4A,
  aac: AAC,
  flac: FLAC,
};

/**
 * Tipo real de un medio por su firma (no por su extensión ni por lo que diga el renderer).
 * Devuelve null si no es ninguno de los formatos admitidos.
 */
export function sniffMedia(b: Uint8Array): MediaType | null {
  if (b.length < 12) return null;
  const ascii = (at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return PNG;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return JPG;
  if (ascii(0, 4) === 'GIF8') return GIF;
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return WEBP;
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return WAV;
  if (ascii(0, 4) === 'OggS') return OGG;
  if (ascii(0, 4) === 'fLaC') return FLAC;
  if (ascii(4, 4) === 'ftyp') return M4A;
  if (ascii(0, 3) === 'ID3') return MP3;
  // Sincronía de trama MPEG: capa III → MP3; capa «00» → AAC en ADTS.
  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return ((b[1]! >> 1) & 3) === 0 ? AAC : MP3;
  return null;
}

const unsupported = (kind: MediaKind) =>
  new MediaError(
    kind === 'image'
      ? 'Formato de imagen no admitido. Usa PNG, JPG, WEBP o GIF.'
      : 'Formato de audio no admitido. Usa MP3, WAV, OGG, M4A, AAC o FLAC.',
  );

export const MAX_BYTES: Record<MediaKind, number> = MEDIA_MAX_BYTES;

export interface ImportedMedia {
  hash: string;
  mime: string;
  name: string;
  size: number;
  kind: MediaKind;
}

export class MediaError extends Error {}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export class MediaStore {
  constructor(readonly dir: string) {}

  fileName(hash: string, mime: string): string {
    const name = mediaFileName(hash, mime);
    if (!name) throw new MediaError('Medio no válido');
    return name;
  }

  pathOf(name: string): string {
    if (!MEDIA_NAME.test(name)) throw new MediaError('Nombre de medio no válido');
    return path.join(this.dir, name);
  }

  async has(name: string): Promise<boolean> {
    return access(this.pathOf(name)).then(
      () => true,
      () => false,
    );
  }

  /** Copia un archivo del usuario (elegido con el diálogo) a la caché. */
  async import(filePath: string, expected: MediaKind): Promise<ImportedMedia> {
    const type = MEDIA_TYPES[path.extname(filePath).slice(1).toLowerCase()];
    if (!type || type.kind !== expected) throw unsupported(expected);
    if ((await stat(filePath)).size > MAX_BYTES[expected]) throw new MediaError('El archivo es demasiado grande.');
    return this.importBytes(await readFile(filePath), expected, path.basename(filePath));
  }

  /**
   * Guarda un medio recibido como bytes (grabación, archivo soltado en la ventana). El tipo se decide
   * por el contenido; el nombre solo es informativo.
   */
  async importBytes(bytes: Uint8Array, expected: MediaKind, name: string): Promise<ImportedMedia> {
    if (bytes.byteLength > MAX_BYTES[expected]) throw new MediaError('El archivo es demasiado grande.');
    const type = sniffMedia(bytes);
    if (!type || type.kind !== expected) throw unsupported(expected);
    const hash = sha256(bytes);
    await this.write(`${hash}.${type.ext}`, bytes);
    // eslint-disable-next-line no-control-regex -- sin caracteres de control en el nombre mostrado
    const clean = name.replace(/[\u0000-\u001f]/g, '').slice(0, 260) || 'Medio';
    return { hash, mime: type.mime, name: clean, size: bytes.byteLength, kind: expected };
  }

  async read(name: string): Promise<Uint8Array> {
    return readFile(this.pathOf(name));
  }

  /** Guarda un medio extraído de un proyecto, comprobando que su contenido coincide con su hash. */
  async putVerified(name: string, bytes: Uint8Array): Promise<void> {
    const m = MEDIA_NAME.exec(name);
    if (!m) throw new MediaError('Nombre de medio no válido');
    if (sha256(bytes) !== m[1]) throw new MediaError('Un medio del proyecto está dañado.');
    await this.write(name, bytes);
  }

  /** Escritura atómica (temporal + renombrado): nunca queda un medio a medias con nombre válido. */
  private async write(name: string, bytes: Uint8Array): Promise<void> {
    if (await this.has(name)) return;
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.pathOf(name)}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(tmp, bytes);
      await rename(tmp, this.pathOf(name));
    } catch (e) {
      await rm(tmp, { force: true });
      if (!(await this.has(name))) throw e;
    }
  }
}

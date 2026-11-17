// Almacén de medios importados: caché por hash (SHA-256) en la carpeta de datos de la aplicación.
// Los medios se guardan dentro del `.dwings` al guardar y se extraen aquí al abrir.
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MEDIA_NAME, mediaFileName } from '@shared/media';

export { MEDIA_NAME };

export type MediaKind = 'image' | 'audio';

export const MEDIA_TYPES: Record<string, { mime: string; kind: MediaKind; ext: string }> = {
  png: { mime: 'image/png', kind: 'image', ext: 'png' },
  jpg: { mime: 'image/jpeg', kind: 'image', ext: 'jpg' },
  jpeg: { mime: 'image/jpeg', kind: 'image', ext: 'jpg' },
  webp: { mime: 'image/webp', kind: 'image', ext: 'webp' },
  gif: { mime: 'image/gif', kind: 'image', ext: 'gif' },
  mp3: { mime: 'audio/mpeg', kind: 'audio', ext: 'mp3' },
  wav: { mime: 'audio/wav', kind: 'audio', ext: 'wav' },
  ogg: { mime: 'audio/ogg', kind: 'audio', ext: 'ogg' },
  opus: { mime: 'audio/ogg', kind: 'audio', ext: 'ogg' },
  m4a: { mime: 'audio/mp4', kind: 'audio', ext: 'm4a' },
  aac: { mime: 'audio/mp4', kind: 'audio', ext: 'm4a' },
  flac: { mime: 'audio/flac', kind: 'audio', ext: 'flac' },
};

export const MAX_BYTES: Record<MediaKind, number> = { image: 50 * 1024 ** 2, audio: 500 * 1024 ** 2 };

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

  /** Copia un archivo del usuario a la caché. Valida extensión, tipo esperado y tamaño. */
  async import(filePath: string, expected: MediaKind): Promise<ImportedMedia> {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const type = MEDIA_TYPES[ext];
    if (!type || type.kind !== expected)
      throw new MediaError(
        expected === 'image'
          ? 'Formato de imagen no admitido. Usa PNG, JPG, WEBP o GIF.'
          : 'Formato de audio no admitido. Usa MP3, WAV, OGG, M4A o FLAC.',
      );
    const size = (await stat(filePath)).size;
    if (size > MAX_BYTES[expected]) throw new MediaError('El archivo es demasiado grande.');
    const bytes = await readFile(filePath);
    const hash = sha256(bytes);
    const name = `${hash}.${type.ext}`;
    await this.write(name, bytes);
    return { hash, mime: type.mime, name: path.basename(filePath).slice(0, 260), size, kind: expected };
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

// Lectura y escritura del contenedor `.dwings` (ADR-003).
import { open, readFile, rename, stat, copyFile, unlink } from 'node:fs/promises';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { CURRENT_FORMAT_VERSION, FORMAT_ID, manifestSchema } from '@core/model/schema';
import { migrate, UnsupportedVersionError } from '@core/model/migrations';
import { checkReferences, validateProject } from '@core/model/validate';
import type { Project } from '@core/model/types';
import { MEDIA_NAME, MediaError, type MediaStore } from './media';
import { mediaFileName } from '@shared/media';

export const PROJECT_EXTENSION = 'dwings';

export const LIMITS = {
  maxFileBytes: 1.5 * 1024 ** 3,
  maxEntries: 20_000,
  maxProjectJsonBytes: 256 * 1024 ** 2,
  maxTotalUncompressedBytes: 8 * 1024 ** 3,
};

export type ProjectFileErrorCode =
  'not-found' | 'too-large' | 'not-a-project' | 'corrupt' | 'unsafe' | 'newer-version' | 'invalid' | 'io';

export class ProjectFileError extends Error {
  constructor(
    readonly code: ProjectFileErrorCode,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ProjectFileError';
  }
}

/** `media`: nombre (`<sha256>.<ext>`) → contenido. Los medios van sin comprimir (STORE). */
export function encodeProject(
  project: Project,
  appVersion: string,
  media: Record<string, Uint8Array> = {},
): Uint8Array {
  const manifest = { format: FORMAT_ID, formatVersion: CURRENT_FORMAT_VERSION, appVersion };
  const files: Zippable = {
    'manifest.json': [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }],
    'project.json': [strToU8(JSON.stringify(project)), { level: 6 }],
  };
  for (const [name, bytes] of Object.entries(media)) files[`media/${name}`] = [bytes, { level: 0 }];
  return zipSync(files);
}

function isSafeEntryName(name: string): boolean {
  if (name.length === 0 || name.length > 512) return false;
  if (name.startsWith('/') || name.includes('\\') || /^[a-zA-Z]:/.test(name)) return false;
  return !name.split('/').some((part) => part === '..');
}

export interface DecodedProject {
  project: Project;
  migrated: boolean;
  formatVersion: number;
  /** Medios incluidos en el archivo: nombre (`<sha256>.<ext>`) → contenido. */
  media: Record<string, Uint8Array>;
  /** Medios que usa el proyecto y no están ni en el archivo ni en la caché (solo con almacén). */
  missingMedia: string[];
}

export function decodeProject(bytes: Uint8Array): DecodedProject {
  // Primera pasada: solo el directorio central, para validar nombres y tamaños sin descomprimir nada.
  const entries: { name: string; originalSize: number }[] = [];
  try {
    unzipSync(bytes, {
      filter: (f) => {
        entries.push({ name: f.name, originalSize: f.originalSize });
        return false;
      },
    });
  } catch {
    throw new ProjectFileError('not-a-project', 'El archivo no es un proyecto de Dra-Wings o está dañado.');
  }
  if (entries.length > LIMITS.maxEntries)
    throw new ProjectFileError('unsafe', 'El proyecto contiene demasiados archivos.');
  const unsafe = entries.find((e) => !isSafeEntryName(e.name));
  if (unsafe) throw new ProjectFileError('unsafe', 'El proyecto contiene rutas no permitidas.', [unsafe.name]);
  const total = entries.reduce((s, e) => s + e.originalSize, 0);
  if (total > LIMITS.maxTotalUncompressedBytes)
    throw new ProjectFileError('unsafe', 'El contenido descomprimido del proyecto es demasiado grande.');
  const projectEntry = entries.find((e) => e.name === 'project.json');
  if (!entries.some((e) => e.name === 'manifest.json') || !projectEntry)
    throw new ProjectFileError(
      'not-a-project',
      'El archivo no es un proyecto de Dra-Wings (falta el manifiesto o el documento).',
    );
  if (projectEntry.originalSize > LIMITS.maxProjectJsonBytes)
    throw new ProjectFileError('unsafe', 'El documento del proyecto es demasiado grande.');

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) =>
        f.name === 'manifest.json' ||
        f.name === 'project.json' ||
        (f.name.startsWith('media/') && MEDIA_NAME.test(f.name.slice(6))),
    });
  } catch {
    throw new ProjectFileError('corrupt', 'El proyecto está dañado y no se puede descomprimir.');
  }

  const parseJson = (name: string): unknown => {
    try {
      return JSON.parse(strFromU8(files[name]!));
    } catch {
      throw new ProjectFileError('corrupt', `El archivo interno ${name} está dañado.`);
    }
  };

  const manifest = manifestSchema.safeParse(parseJson('manifest.json'));
  if (!manifest.success) throw new ProjectFileError('not-a-project', 'El manifiesto del proyecto no es válido.');

  let migrated: boolean;
  let doc = parseJson('project.json');
  try {
    ({ doc, migrated } = migrate(doc, manifest.data.formatVersion));
  } catch (e) {
    if (e instanceof UnsupportedVersionError)
      throw new ProjectFileError(e.found > e.supported ? 'newer-version' : 'invalid', e.message);
    throw e;
  }

  const result = validateProject(doc);
  if (!result.ok) throw new ProjectFileError('invalid', 'El proyecto contiene datos no válidos.', result.issues);
  const refs = checkReferences(result.project);
  if (refs.length)
    throw new ProjectFileError('invalid', 'El proyecto contiene referencias incoherentes.', refs.slice(0, 5));
  const media: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files))
    if (name.startsWith('media/') && MEDIA_NAME.test(name.slice(6))) media[name.slice(6)] = data;
  return { project: result.project, migrated, formatVersion: manifest.data.formatVersion, media, missingMedia: [] };
}

export async function readProjectFile(filePath: string, store?: MediaStore): Promise<DecodedProject> {
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    throw new ProjectFileError('not-found', 'No se encuentra el archivo. Puede que se haya movido o borrado.');
  }
  if (size > LIMITS.maxFileBytes)
    throw new ProjectFileError('too-large', 'El archivo es demasiado grande para abrirlo.');
  let bytes: Uint8Array;
  try {
    bytes = await readFile(filePath);
  } catch {
    throw new ProjectFileError('io', 'No se pudo leer el archivo. Comprueba que tienes permiso para abrirlo.');
  }
  const decoded = decodeProject(bytes);
  if (store) {
    try {
      for (const [name, data] of Object.entries(decoded.media)) await store.putVerified(name, data);
    } catch (e) {
      throw new ProjectFileError('corrupt', e instanceof MediaError ? e.message : 'No se pudieron extraer los medios.');
    }
    // Un proyecto incompleto se abre igualmente: los elementos sin medio se ven como marcadores.
    for (const asset of decoded.project.assets) {
      const name = mediaFileName(asset.hash, asset.mime);
      if (!name || !(await store.has(name))) decoded.missingMedia.push(asset.name);
    }
  }
  return decoded;
}

async function renameWithRetry(from: string, to: string, attempts = 5): Promise<void> {
  // En Windows, antivirus o indexadores pueden bloquear el archivo durante un instante.
  for (let i = 0; ; i++) {
    try {
      await rename(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (i >= attempts - 1 || !['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '')) throw e;
      await new Promise((r) => setTimeout(r, 50 * 2 ** i));
    }
  }
}

/**
 * Escritura atómica: temporal en la misma carpeta + fsync + rename. Si existe el destino, antes se
 * copia a `.bak`. Si algo falla, el archivo original queda intacto.
 */
export async function writeFileAtomic(target: string, bytes: Uint8Array, { backup = true } = {}): Promise<void> {
  const tmp = `${target}.tmp`;
  try {
    const fh = await open(tmp, 'w');
    try {
      await fh.writeFile(bytes);
      await fh.sync();
    } finally {
      await fh.close();
    }
    if (backup) {
      try {
        await copyFile(target, `${target}.bak`);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    }
    await renameWithRetry(tmp, target);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

export async function writeProjectFile(
  filePath: string,
  project: Project,
  appVersion: string,
  store?: MediaStore,
): Promise<void> {
  const media: Record<string, Uint8Array> = {};
  if (store)
    for (const asset of project.assets) {
      try {
        const name = store.fileName(asset.hash, asset.mime);
        media[name] = await store.read(name);
      } catch {
        throw new ProjectFileError('io', `No se encuentra el medio «${asset.name}». Vuelve a importarlo.`);
      }
    }
  try {
    await writeFileAtomic(filePath, encodeProject(project, appVersion, media));
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    const message =
      code === 'ENOSPC'
        ? 'No se pudo guardar: el disco está lleno. Libera espacio y vuelve a intentarlo.'
        : code === 'EACCES' || code === 'EPERM'
          ? 'No se pudo guardar: no tienes permiso para escribir en esa carpeta o el archivo está bloqueado.'
          : 'No se pudo guardar el proyecto. El archivo anterior se ha conservado.';
    throw new ProjectFileError('io', message);
  }
}

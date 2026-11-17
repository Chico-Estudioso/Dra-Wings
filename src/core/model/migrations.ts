// Migraciones del documento. Cada función recibe el JSON de la versión N y devuelve el de N+1.
// Se aplican antes de validar con el esquema actual.
import { CURRENT_FORMAT_VERSION } from './schema';

export type Migration = (doc: unknown) => unknown;

/** `migrations[n]` convierte un documento de la versión n a la n+1. */
export const migrations: Record<number, Migration> = {
  // Ejemplo de la forma que tendrán: 1: (doc) => ({ ...(doc as object), nuevoCampo: valorPorDefecto }),
};

export class UnsupportedVersionError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(
      found > supported
        ? `Este proyecto se creó con una versión más reciente de Dra-Wings (formato ${found}). Actualiza la aplicación para abrirlo.`
        : `No se puede migrar el proyecto desde el formato ${found}.`,
    );
    this.name = 'UnsupportedVersionError';
  }
}

export function migrate(
  doc: unknown,
  fromVersion: number,
  table: Record<number, Migration> = migrations,
  target = CURRENT_FORMAT_VERSION,
): { doc: unknown; migrated: boolean } {
  if (fromVersion > target) throw new UnsupportedVersionError(fromVersion, target);
  let current = doc;
  for (let v = fromVersion; v < target; v++) {
    const step = table[v];
    if (!step) throw new UnsupportedVersionError(fromVersion, target);
    current = step(current);
  }
  return { doc: current, migrated: fromVersion < target };
}

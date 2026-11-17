// Destino de una exportación de vídeo. El proceso principal elige la ruta (diálogo nativo), escribe en
// un temporal `.part` lo que le manda el renderer por posiciones y, al terminar, lo renombra.
// El renderer solo conoce un identificador opaco, nunca la ruta.
import { randomUUID } from 'node:crypto';
import { open, rename, rm, type FileHandle } from 'node:fs/promises';

/** Tamaño máximo de un trozo y del archivo final (defensivo). */
export const EXPORT_LIMITS = { maxChunkBytes: 64 * 1024 ** 2, maxFileBytes: 64 * 1024 ** 3 };

export class ExportError extends Error {}

interface Session {
  id: string;
  target: string;
  part: string;
  fh: FileHandle;
  size: number;
}

export class ExportSessions {
  private current: Session | null = null;

  get active(): boolean {
    return this.current !== null;
  }

  /** Abre el temporal junto al destino. Solo hay una exportación a la vez. */
  async begin(target: string): Promise<string> {
    if (this.current) throw new ExportError('Ya hay una exportación en curso.');
    const part = `${target}.part`;
    const fh = await open(part, 'w');
    this.current = { id: randomUUID(), target, part, fh, size: 0 };
    return this.current.id;
  }

  private session(id: unknown): Session {
    if (!this.current || typeof id !== 'string' || id !== this.current.id)
      throw new ExportError('La exportación ya no está activa.');
    return this.current;
  }

  async write(id: unknown, position: unknown, data: unknown): Promise<void> {
    const s = this.session(id);
    if (!Number.isSafeInteger(position) || (position as number) < 0) throw new ExportError('Posición no válida.');
    if (!(data instanceof Uint8Array) || data.byteLength > EXPORT_LIMITS.maxChunkBytes)
      throw new ExportError('Datos no válidos.');
    const end = (position as number) + data.byteLength;
    if (end > EXPORT_LIMITS.maxFileBytes) throw new ExportError('El vídeo es demasiado grande.');
    await s.fh.write(data, 0, data.byteLength, position as number);
    s.size = Math.max(s.size, end);
  }

  /** Asegura los datos en disco y sustituye el destino por el vídeo completo. Devuelve la ruta final. */
  async finish(id: unknown): Promise<string> {
    const s = this.session(id);
    this.current = null;
    try {
      await s.fh.sync();
      await s.fh.close();
      await rename(s.part, s.target);
      return s.target;
    } catch (e) {
      await rm(s.part, { force: true });
      throw e;
    }
  }

  /** Cancela (o limpia tras un error): borra el temporal. El destino previo, si existía, no se toca. */
  async cancel(id?: unknown): Promise<void> {
    const s = this.current;
    if (!s || (id !== undefined && id !== s.id)) return;
    this.current = null;
    await s.fh.close().catch(() => undefined);
    await rm(s.part, { force: true });
  }
}

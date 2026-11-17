// Copias de recuperación del documento (autoguardado), fuera del archivo del usuario.
import { mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { projectSchema } from '@core/model/schema';
import type { Project } from '@core/model/types';
import { projectIdSchema, type RecoveryEntry } from '@shared/ipc';
import { writeFileAtomic } from './project-file';

const recoveryFileSchema = z.object({
  version: z.literal(1),
  savedAt: z.iso.datetime(),
  filePath: z.string().nullable(),
  project: z.unknown(),
});

export class RecoveryStore {
  constructor(private readonly dir: string) {}

  private fileFor(projectId: string): string {
    return path.join(this.dir, `${projectIdSchema.parse(projectId)}.json`);
  }

  async write(project: Project, filePath: string | null, now = new Date()): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const body = { version: 1, savedAt: now.toISOString(), filePath, project };
    await writeFileAtomic(this.fileFor(project.id), new TextEncoder().encode(JSON.stringify(body)), { backup: false });
  }

  async discard(projectId: string): Promise<void> {
    await unlink(this.fileFor(projectId)).catch(() => {});
  }

  private async readRaw(projectId: string) {
    const raw = JSON.parse(await readFile(this.fileFor(projectId), 'utf8'));
    return recoveryFileSchema.parse(raw);
  }

  /** Recuperaciones más recientes que su archivo (o de proyectos nunca guardados). */
  async list(): Promise<RecoveryEntry[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const out: RecoveryEntry[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const projectId = name.slice(0, -5);
      if (!projectIdSchema.safeParse(projectId).success) continue;
      try {
        const r = await this.readRaw(projectId);
        const project = projectSchema.safeParse(r.project);
        if (!project.success) continue;
        if (r.filePath) {
          const mtime = await stat(r.filePath).then(
            (s) => s.mtime,
            () => null,
          );
          if (mtime && mtime.getTime() >= new Date(r.savedAt).getTime()) {
            await this.discard(projectId); // el archivo ya contiene esos cambios
            continue;
          }
        }
        out.push({ projectId, name: project.data.name, savedAt: r.savedAt, filePath: r.filePath });
      } catch {
        // Recuperación ilegible: se ignora sin borrarla, por si se puede inspeccionar a mano.
      }
    }
    return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async read(projectId: string): Promise<{ project: unknown; filePath: string | null }> {
    const r = await this.readRaw(projectId);
    return { project: r.project, filePath: r.filePath };
  }
}

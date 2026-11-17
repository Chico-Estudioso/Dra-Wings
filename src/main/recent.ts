// Lista de proyectos recientes, guardada en la carpeta de datos de la aplicación.
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { RecentEntry } from '@shared/ipc';
import { writeFileAtomic } from './project-file';

const MAX_RECENT = 12;
const storedSchema = z.array(z.object({ filePath: z.string(), name: z.string(), openedAt: z.string() }));
type Stored = z.infer<typeof storedSchema>;

const samePath = (a: string, b: string) =>
  process.platform === 'win32' || process.platform === 'darwin' ? a.toLowerCase() === b.toLowerCase() : a === b;

export class RecentStore {
  constructor(private readonly file: string) {}

  private async load(): Promise<Stored> {
    try {
      return storedSchema.parse(JSON.parse(await readFile(this.file, 'utf8')));
    } catch {
      return [];
    }
  }

  private async save(list: Stored): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFileAtomic(this.file, new TextEncoder().encode(JSON.stringify(list, null, 2)), { backup: false });
  }

  async touch(filePath: string, name: string, now = new Date()): Promise<void> {
    const list = (await this.load()).filter((e) => !samePath(e.filePath, filePath));
    list.unshift({ filePath, name, openedAt: now.toISOString() });
    await this.save(list.slice(0, MAX_RECENT));
  }

  async remove(filePath: string): Promise<void> {
    await this.save((await this.load()).filter((e) => !samePath(e.filePath, filePath)));
  }

  async has(filePath: string): Promise<boolean> {
    return (await this.load()).some((e) => samePath(e.filePath, filePath));
  }

  async list(): Promise<RecentEntry[]> {
    const list = await this.load();
    return Promise.all(
      list.map(async (e) => ({
        ...e,
        exists: await access(e.filePath).then(
          () => true,
          () => false,
        ),
      })),
    );
  }
}

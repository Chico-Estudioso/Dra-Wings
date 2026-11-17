import type { z } from 'zod';
import { projectSchema } from './schema';
import type { Project } from './types';

export type ValidationResult = { ok: true; project: Project } | { ok: false; issues: string[] };

function describePath(path: PropertyKey[]): string {
  if (path.length === 0) return 'proyecto';
  return path
    .map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`))
    .join('')
    .replace(/^\./, '');
}

export function formatIssues(error: z.ZodError, max = 5): string[] {
  const lines = error.issues.slice(0, max).map((i) => `${describePath(i.path)}: ${i.message}`);
  if (error.issues.length > max) lines.push(`… y ${error.issues.length - max} problemas más`);
  return lines;
}

export function validateProject(data: unknown): ValidationResult {
  const r = projectSchema.safeParse(data);
  return r.success ? { ok: true, project: r.data } : { ok: false, issues: formatIssues(r.error) };
}

/** Comprueba integridad referencial que el esquema por sí solo no cubre. */
export function checkReferences(project: Project): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const seen = (id: string, where: string) => {
    if (ids.has(id)) problems.push(`Identificador duplicado «${id}» en ${where}`);
    ids.add(id);
  };
  for (const s of project.scenes) {
    seen(s.id, 'escena');
    for (const l of s.layers) {
      seen(l.id, 'capa');
      for (const it of l.items ?? []) seen(it.id, 'elemento');
      for (const c of l.cels ?? []) {
        seen(c.id, 'fotograma');
        for (const it of c.items) seen(it.id, 'elemento');
      }
    }
  }
  const assetIds = new Set(project.assets.map((a) => a.id));
  for (const t of project.audioTracks)
    for (const c of t.clips)
      if (!assetIds.has(c.assetId)) problems.push(`El clip de audio «${c.id}» apunta a un medio inexistente`);
  return problems;
}

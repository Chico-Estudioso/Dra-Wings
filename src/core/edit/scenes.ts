// Escenas: se reproducen en orden. El tiempo global es la suma de las duraciones anteriores.
import { createScene, newId } from '../model/factory';
import type { Project, Scene } from '../model/types';
import type { Ticks } from '../time/ticks';
import { deepClone } from './clone';
import { withNewIds } from './ops';

export function addScene(project: Project, afterSceneId?: string): string {
  const used = new Set(project.scenes.map((s) => s.name));
  let n = project.scenes.length + 1;
  while (used.has(`Escena ${n}`)) n++;
  const scene = createScene(`Escena ${n}`);
  const idx = afterSceneId ? project.scenes.findIndex((s) => s.id === afterSceneId) : -1;
  if (idx >= 0) project.scenes.splice(idx + 1, 0, scene);
  else project.scenes.push(scene);
  return scene.id;
}

export function duplicateScene(project: Project, sceneId: string): string | null {
  const idx = project.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return null;
  const copy: Scene = deepClone(project.scenes[idx]!);
  copy.id = newId();
  copy.name = `${copy.name} (copia)`;
  for (const layer of copy.layers) {
    layer.id = newId();
    layer.items?.forEach((i) => withNewIds(i));
    layer.cels?.forEach((c) => {
      c.id = newId();
      c.items.forEach((i) => withNewIds(i));
    });
  }
  project.scenes.splice(idx + 1, 0, copy);
  return copy.id;
}

/** Elimina una escena (siempre queda al menos una). Devuelve la que debería quedar activa. */
export function removeScene(project: Project, sceneId: string): string {
  const idx = project.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0 || project.scenes.length === 1) return project.scenes[Math.max(0, idx)]!.id;
  project.scenes.splice(idx, 1);
  return project.scenes[Math.max(0, idx - 1)]!.id;
}

export function moveScene(project: Project, sceneId: string, direction: -1 | 1): void {
  const idx = project.scenes.findIndex((s) => s.id === sceneId);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= project.scenes.length) return;
  [project.scenes[idx], project.scenes[target]] = [project.scenes[target]!, project.scenes[idx]!];
}

export function sceneStart(project: Project, sceneId: string): Ticks {
  let t = 0;
  for (const s of project.scenes) {
    if (s.id === sceneId) return t;
    t += s.duration;
  }
  return t;
}

export function projectDuration(project: Project): Ticks {
  return project.scenes.reduce((t, s) => t + s.duration, 0);
}

/** Escena e instante local para un instante global (el final cae en el último instante de la última). */
export function locateTime(project: Project, globalTick: Ticks): { scene: Scene; local: Ticks } {
  let start = 0;
  for (const scene of project.scenes) {
    if (globalTick < start + scene.duration) return { scene, local: Math.max(0, globalTick - start) };
    start += scene.duration;
  }
  const last = project.scenes[project.scenes.length - 1]!;
  return { scene: last, local: last.duration };
}

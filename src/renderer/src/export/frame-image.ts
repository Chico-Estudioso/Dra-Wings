// Guardar el fotograma del cabezal como imagen PNG. Se dibuja con la misma función que el vídeo
// (`drawSceneInProject`): lo que se guarda es exactamente ese fotograma del vídeo exportado.
import { usedAssetIds } from '@core/audio/clips';
import { sceneStart } from '@core/edit/scenes';
import { exportSize, type Resolution } from '@core/export/plan';
import type { Project } from '@core/model/types';
import { PathCache } from '@core/render/draw';
import { drawSceneInProject } from '@core/render/frame';
import { secondsFromTicks, type Ticks } from '@core/time/ticks';
import type { ImageSaveResult } from '@shared/ipc';
import { fontsReady } from '../editor/fonts';
import { loadImage } from '../editor/media';

/** Dibuja el instante `local` de una escena al tamaño de la resolución elegida y lo codifica en PNG. */
export async function renderFramePng(
  project: Project,
  sceneId: string | null,
  local: Ticks,
  resolution: Resolution,
): Promise<Uint8Array> {
  const scene = project.scenes.find((s) => s.id === sceneId) ?? project.scenes[0]!;
  await fontsReady();
  const used = usedAssetIds(project);
  const images = new Map<string, ImageBitmap>();
  for (const a of project.assets)
    if (a.mime.startsWith('image/') && used.has(a.id)) images.set(a.id, await loadImage(a));
  const { width, height } = exportSize(project.settings, resolution);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.setTransform(width / project.settings.width, 0, 0, height / project.settings.height, 0, 0);
  drawSceneInProject(ctx, project, scene, Math.min(local, scene.duration), new PathCache(), images);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

/** Dibuja el fotograma y pide al proceso principal dónde guardarlo. */
export async function saveFrameImage(
  project: Project,
  sceneId: string | null,
  local: Ticks,
  resolution: Resolution,
): Promise<ImageSaveResult> {
  let png: Uint8Array;
  try {
    png = await renderFramePng(project, sceneId, local, resolution);
  } catch {
    return { status: 'error', message: 'No se pudo dibujar el fotograma. Comprueba las imágenes del proyecto.' };
  }
  const scene = project.scenes.find((s) => s.id === sceneId) ?? project.scenes[0]!;
  const seconds = secondsFromTicks(sceneStart(project, scene.id) + local);
  return window.dw.saveFrameImage(png, seconds);
}

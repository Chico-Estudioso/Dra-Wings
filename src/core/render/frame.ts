// Un fotograma tal como sale en el vídeo. Lo usan la vista previa del editor y la exportación,
// así que lo que se ve en el cabezal es exactamente lo que se exporta.
import { locateTime } from '../edit/scenes';
import type { Project, Scene } from '../model/types';
import type { Ticks } from '../time/ticks';
import type { StaticTransform } from '../geometry/matrix';
import { drawRenderList, type Ctx2D, type ImageSources, type PathCache } from './draw';
import { cameraMatrix, evaluateScene } from './evaluate';
import { boilAt } from './boil';
import { elasticAmount } from '../anim/elastic';
import { sceneBeats } from '../audio/rhythm';

/**
 * Dibuja la escena en el instante `local` (relativo a la escena) sobre la hoja (0,0)-(width,height)
 * de la transformación actual del contexto: fondo, recorte a la hoja, cámara y elementos.
 */
export function drawSceneFrame(
  ctx: Ctx2D,
  settings: Project['settings'],
  scene: Scene,
  local: Ticks,
  cache: PathCache,
  images?: ImageSources,
  overrides?: ReadonlyMap<string, StaticTransform>,
  beats?: readonly Ticks[],
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, settings.width, settings.height);
  ctx.clip();
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, settings.width, settings.height);
  ctx.transform(...cameraMatrix(scene, local));
  const boil = boilAt(settings.boil, local, settings.fps);
  const list = evaluateScene(scene, local, {
    mode: 'play',
    overrides,
    beats,
    elastic: elasticAmount(settings.elastic),
    unit: settings.width / 1920,
  });
  drawRenderList(ctx, list, cache, images, boil);
  ctx.restore();
}

/** Fotograma del instante global `tick` del proyecto (las escenas se suceden). */
export function drawProjectFrame(
  ctx: Ctx2D,
  project: Project,
  tick: Ticks,
  cache: PathCache,
  images?: ImageSources,
): void {
  const { scene, local } = locateTime(project, tick);
  const beats = sceneBeats(project, scene.id, scene.duration).map((b) => b.t);
  drawSceneFrame(ctx, project.settings, scene, local, cache, images, undefined, beats);
}

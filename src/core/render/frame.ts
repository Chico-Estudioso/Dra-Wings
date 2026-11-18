// Un fotograma tal como sale en el vídeo. Lo usan la vista previa del editor y la exportación,
// así que lo que se ve en el cabezal es exactamente lo que se exporta.
import { locateTime } from '../edit/scenes';
import type { Project, Scene } from '../model/types';
import type { Ticks } from '../time/ticks';
import type { StaticTransform } from '../geometry/matrix';
import { drawRenderList, textTip, type Ctx2D, type ImageSources, type PathCache } from './draw';
import { cameraMatrix, evaluateScene } from './evaluate';
import { boilAt } from './boil';
import { drawingTip } from './hand-tip';
import { drawHand } from './hand';
import { elasticAmount } from '../anim/elastic';
import { sceneBeats, type Beat } from '../audio/rhythm';
import { sceneVoice } from '../audio/voice';
import { barPulse, beatsOrPulse } from '../edit/beat-sync';
import { transitionAt } from './transition';

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
  beats?: readonly Beat[],
  voice?: (t: Ticks) => number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, settings.width, settings.height);
  ctx.clip();
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, settings.width, settings.height);
  if (scene.beatPulse) {
    // Cámara que late: zoom breve hacia el centro al empezar cada compás.
    const z = barPulse(beatsOrPulse(beats ?? [], scene.duration), local);
    ctx.translate(settings.width / 2, settings.height / 2);
    ctx.scale(z, z);
    ctx.translate(-settings.width / 2, -settings.height / 2);
  }
  ctx.transform(...cameraMatrix(scene, local));
  const boil = boilAt(settings.boil, local, settings.fps);
  const list = evaluateScene(scene, local, {
    mode: 'play',
    overrides,
    beats: beats?.map((b) => b.t),
    voice,
    elastic: elasticAmount(settings.elastic),
    unit: settings.width / 1920,
  });
  drawRenderList(ctx, list, cache, images, boil);
  // Mano que dibuja: con la punta donde se está dibujando (en el espacio de la escena).
  const hand = settings.hand ?? 'none';
  if (hand !== 'none') {
    const tip = drawingTip(list, (t, progress) => textTip(ctx, t, progress));
    if (tip) drawHand(ctx, tip, Math.min(settings.width, settings.height) * 0.34, hand);
  }
  ctx.restore();
}

/**
 * Fotograma de una escena del proyecto en su instante `local`, con la transición de entrada si está
 * en curso (mientras dura se ve el último fotograma de la escena anterior).
 */
export function drawSceneInProject(
  ctx: Ctx2D,
  project: Project,
  scene: Scene,
  local: Ticks,
  cache: PathCache,
  images?: ImageSources,
  overrides?: ReadonlyMap<string, StaticTransform>,
): void {
  const draw = (s: Scene, t: Ticks, ov?: ReadonlyMap<string, StaticTransform>) =>
    drawSceneFrame(
      ctx,
      project.settings,
      s,
      t,
      cache,
      images,
      ov,
      sceneBeats(project, s.id, s.duration),
      sceneVoice(project, s.id),
    );
  const tr = transitionAt(project, scene, local);
  if (!tr) return draw(scene, local, overrides);
  const { width: w, height: h, background } = project.settings;
  const { p, prev } = tr;
  const last = Math.max(0, prev.duration - 1);
  ctx.save();
  // Nada de las escenas en movimiento se sale de la hoja.
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  switch (tr.kind) {
    case 'fade':
      draw(prev, last);
      ctx.globalAlpha *= p;
      draw(scene, local, overrides);
      break;
    case 'dip': {
      // A blanco (el color de fondo) y de vuelta.
      const out = p < 0.5;
      if (out) draw(prev, last);
      else draw(scene, local, overrides);
      ctx.globalAlpha *= out ? p * 2 : (1 - p) * 2;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'slide':
      ctx.translate(-p * w, 0);
      draw(prev, last);
      ctx.translate(w, 0);
      draw(scene, local, overrides);
      break;
    case 'zoom': {
      const a = ctx.globalAlpha;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1 + p * 0.35, 1 + p * 0.35);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = a * (1 - p);
      draw(prev, last);
      ctx.restore();
      ctx.translate(w / 2, h / 2);
      ctx.scale(0.85 + p * 0.15, 0.85 + p * 0.15);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = a * p;
      draw(scene, local, overrides);
      break;
    }
    case 'wipe':
      draw(prev, last);
      ctx.beginPath();
      ctx.rect(0, 0, p * w, h);
      ctx.clip();
      draw(scene, local, overrides);
      break;
    case 'iris':
      draw(prev, last);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (p * Math.hypot(w, h)) / 2, 0, Math.PI * 2);
      ctx.clip();
      draw(scene, local, overrides);
      break;
  }
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
  drawSceneInProject(ctx, project, scene, local, cache, images);
}

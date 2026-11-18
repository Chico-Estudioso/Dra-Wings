// Proyecto de ejemplo para aprender viéndolo: tres escenas hechas con la biblioteca, textos que se
// escriben solos, tiempos automáticos y un zoom de cámara. Todo es editable.
import { setValueAt } from '../anim/keyframes';
import { appendTiming, fitSceneDuration } from '../anim/timing';
import { addScene } from '../edit/scenes';
import { createProject, createText } from '../model/factory';
import type { FontId, Item, Project, Scene } from '../model/types';
import { TICKS_PER_SECOND } from '../time/ticks';
import { buildCharacter, CHARACTER_PRESETS } from './character';
import { buildAsset, placeGroup, TEMPLATES } from './place';

/** Mide un texto (en el renderer, con las fuentes reales) para darle su caja. */
export type MeasureText = (text: string, font: FontId, size: number, lineHeight: number) => { w: number; h: number };

const INK = '#1d1d1f';
const GROUP_DRAW = 1.5 * TICKS_PER_SECOND;

export function buildExampleProject(measure: MeasureText, now = new Date()): Project {
  const p = createProject({ name: 'Ejemplo: mi primera historia', aspect: 'landscape', fps: 30, mode: 'guided', now });
  const { width: W, height: H } = p.settings;

  const add = (scene: Scene, ...items: Item[]) => {
    for (const it of items) {
      appendTiming(scene, it);
      // Ritmo algo más ágil que el predeterminado para que el ejemplo no se haga largo.
      if (it.type === 'group' && it.enter) it.enter.duration = Math.min(it.enter.duration, GROUP_DRAW);
      scene.layers[0]!.items!.push(it);
    }
  };
  const text = (scene: Scene, str: string, cy: number, size: number, font: FontId = 'hand', color = INK) => {
    const lineHeight = 1.2;
    const m = measure(str, font, size, lineHeight);
    add(
      scene,
      createText(W / 2 - m.w / 2, cy * H - m.h / 2, {
        text: str,
        font,
        size,
        color,
        align: 'center',
        lineHeight,
        ...m,
      }),
    );
  };
  const template = (id: string) => TEMPLATES.find((t) => t.id === id)!.build(W, H);

  // 1. Había una vez: la escena de partida se dibuja y la cámara se acerca a la casa.
  const s1 = p.scenes[0]!;
  s1.name = 'Había una vez';
  add(s1, ...template('campo'));
  text(s1, 'Había una vez una casa en el campo…', 0.91, 70);
  // El texto se lee un segundo, se desvanece y entonces la cámara se acerca a la casa.
  const items1 = s1.layers[0]!.items!;
  const drawn = items1.reduce((t, it) => Math.max(t, it.in + (it.enter?.duration ?? 0)), 0);
  const zoomFrom = drawn + TICKS_PER_SECOND;
  const caption = items1[items1.length - 1]!;
  caption.out = zoomFrom;
  caption.exit = { kind: 'fade', duration: Math.round(0.6 * TICKS_PER_SECOND) };
  const zoomTo = zoomFrom + 2 * TICKS_PER_SECOND;
  const zoom = 1.5;
  const fw = W / zoom;
  const fh = H / zoom;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  s1.camera.x = setValueAt(s1.camera.x, zoomTo, clamp(0.32 * W - fw / 2, W - fw), true, zoomFrom);
  s1.camera.y = setValueAt(s1.camera.y, zoomTo, clamp(0.6 * H - fh / 2, H - fh), true, zoomFrom);
  s1.camera.scaleX = setValueAt(s1.camera.scaleX, zoomTo, zoom, true, zoomFrom);
  s1.duration = Math.max(s1.duration, zoomTo + TICKS_PER_SECOND);

  // 2. Un día en la ciudad, con un personaje de la biblioteca.
  const s2Id = addScene(p, s1.id);
  const s2 = p.scenes.find((s) => s.id === s2Id)!;
  s2.name = 'Un día en la ciudad';
  add(s2, ...template('ciudad'));
  const lucia = CHARACTER_PRESETS.find((c) => c.id === 'lucia')!;
  add(
    s2,
    placeGroup(
      { ...buildCharacter(lucia.options), name: lucia.name },
      { cx: 0.68 * W, bottom: 0.84 * H, height: 0.42 * H },
    ),
  );
  text(s2, 'Un día, Lucía se fue a la ciudad.', 0.92, 70);
  fitSceneDuration(s2);

  // 3. Ahora tú: qué hacer después.
  const s3Id = addScene(p, s2.id);
  const s3 = p.scenes.find((s) => s.id === s3Id)!;
  s3.name = 'Ahora tú';
  add(s3, placeGroup(buildAsset('corazon'), { cx: 0.5 * W, cy: 0.3 * H, height: 0.26 * H }));
  text(s3, '¡Ahora te toca a ti!', 0.55, 120, 'script', '#c2521e');
  text(s3, 'Cambia los textos, graba tu voz en «Audio» y exporta el vídeo.', 0.74, 46, 'rounded');
  fitSceneDuration(s3);

  for (const s of p.scenes) fitSceneDuration(s);
  return p;
}

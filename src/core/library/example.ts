// Proyecto de ejemplo para aprender viéndolo: tres escenas hechas con la biblioteca, textos que se
// escriben solos (palabra a palabra o con letras que saltan, con contorno y sombra), tiempos
// automáticos, un zoom de cámara, transiciones, fondos en degradado, un personaje que cambia de
// expresión y salta, elementos que saltan en ola y recursos con vida propia. Todo es editable.
import { setValueAt } from '../anim/keyframes';
import { appendTiming, fitSceneDuration } from '../anim/timing';
import { addScene } from '../edit/scenes';
import { createProject, createText } from '../model/factory';
import type { FontId, Item, Project, Scene, TextItem } from '../model/types';
import { applyPreset } from '../anim/presets';
import { waveStarts } from '../anim/copy-motion';
import { TICKS_PER_SECOND } from '../time/ticks';
import { buildCharacter, CHARACTER_PRESETS, setCharacterLook } from './character';
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
  const text = (
    scene: Scene,
    str: string,
    cy: number,
    size: number,
    font: FontId = 'hand',
    color = INK,
    reveal?: TextItem['reveal'],
  ) => {
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
    const last = scene.layers[0]!.items!.at(-1)!;
    if (reveal && last.type === 'text') last.reveal = reveal;
  };
  const template = (id: string) => TEMPLATES.find((t) => t.id === id)!.build(W, H);

  // 1. Había una vez: la escena de partida se dibuja y la cámara se acerca a la casa.
  const s1 = p.scenes[0]!;
  s1.name = 'Había una vez';
  // Cielo en degradado: azul claro arriba, cálido abajo.
  s1.background = '#d9ecf7';
  s1.gradient = '#fff3b0';
  add(s1, ...template('campo'));
  text(s1, 'Había una vez una casa en el campo…', 0.91, 70, 'hand', INK, 'words');
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
  // Entra abriéndose en círculo desde el centro.
  s2.transition = { kind: 'iris', duration: Math.round(0.8 * TICKS_PER_SECOND) };
  add(s2, ...template('ciudad'));
  const lucia = CHARACTER_PRESETS.find((c) => c.id === 'lucia')!;
  const luciaGroup = placeGroup(
    { ...buildCharacter(lucia.options), name: lucia.name },
    { cx: 0.68 * W, bottom: 0.84 * H, height: 0.42 * H },
  );
  add(s2, luciaGroup);
  text(s2, 'Un día, Lucía se fue a la ciudad.', 0.92, 70, 'hand', INK, 'words');
  // Al terminar de escribirse el texto, Lucía se alegra y da un salto.
  const items2 = s2.layers[0]!.items!;
  const lastText = items2[items2.length - 1]!;
  const joy = lastText.in + (lastText.enter?.duration ?? 0) + Math.round(0.4 * TICKS_PER_SECOND);
  setCharacterLook(luciaGroup, joy, { expression: 'risa', pose: 'brazos-arriba' });
  const jumpEnd = applyPreset(luciaGroup, 'jump', joy, { page: { width: W, height: H } });
  s2.duration = Math.max(s2.duration, jumpEnd + TICKS_PER_SECOND);
  fitSceneDuration(s2);

  // 3. Ahora tú: qué hacer después.
  const s3Id = addScene(p, s2.id);
  const s3 = p.scenes.find((s) => s.id === s3Id)!;
  s3.name = 'Ahora tú';
  s3.transition = { kind: 'fade', duration: Math.round(0.8 * TICKS_PER_SECOND) };
  s3.background = '#fde2e4';
  s3.gradient = '#e9e1f7';
  const row = [
    placeGroup(buildAsset('estrella'), { cx: 0.3 * W, cy: 0.3 * H, height: 0.16 * H }),
    placeGroup(buildAsset('corazon'), { cx: 0.5 * W, cy: 0.3 * H, height: 0.26 * H }),
    placeGroup(buildAsset('estrella'), { cx: 0.7 * W, cy: 0.3 * H, height: 0.16 * H }),
  ];
  add(s3, ...row);
  text(s3, '¡Ahora te toca a ti!', 0.55, 120, 'script', '#c2521e', 'bounce');
  // Letras con contorno blanco y sombra: se leen sobre cualquier fondo.
  const title = s3.layers[0]!.items!.at(-1)!;
  if (title.type === 'text') {
    title.outline = { color: '#ffffff', width: 0.08 };
    title.shadow = true;
  }
  text(s3, 'Cambia los textos, graba tu voz en «Audio» y exporta el vídeo.', 0.74, 46, 'rounded', INK, 'words');
  // Cuando ya se ha escrito todo, estrella, corazón y estrella saltan en ola.
  const items3 = s3.layers[0]!.items!;
  const written = items3.reduce((t, it) => Math.max(t, it.in + (it.enter?.duration ?? 0)), 0);
  const starts = waveStarts(
    row.map(() => written),
    { step: Math.round(0.25 * TICKS_PER_SECOND) },
  );
  let waveEnd = 0;
  row.forEach((g, i) => {
    waveEnd = Math.max(waveEnd, applyPreset(g, 'jump', starts[i]!, { page: { width: W, height: H } }));
  });
  fitSceneDuration(s3);
  s3.duration = Math.max(s3.duration, waveEnd + TICKS_PER_SECOND);

  for (const s of p.scenes) fitSceneDuration(s);
  return p;
}

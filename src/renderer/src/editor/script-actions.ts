// Crear escenas desde un guion: cada bloque se maqueta con las fuentes reales y se convierte en una
// escena con su texto escribiéndose solo. Un solo paso de deshacer.
import { findScene, layerItemCount } from '@core/edit/ops';
import { addScene } from '@core/edit/scenes';
import { fitText, sceneNameFor, scriptSceneDuration, writingDuration } from '@core/edit/script';
import { createText } from '@core/model/factory';
import { measureText } from '@core/render/draw';
import type { TextReveal } from '@core/render/text-reveal';
import { TICKS_PER_SECOND, ticksPerFrame } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { goToScene } from './actions';
import { useEditor } from './editor-store';
import { fontsReady } from './fonts';

const LINE_HEIGHT = 1.25;
const INK = '#1d1d1f';

export async function createScenesFromScript(
  blocks: string[],
  reveal: TextReveal,
  { outlined = false }: { outlined?: boolean } = {},
): Promise<void> {
  const app = useApp.getState();
  const project = app.doc?.project;
  const currentId = useEditor.getState().sceneId;
  if (!project || !currentId || !blocks.length) return;
  await fontsReady();
  const ctx = document.createElement('canvas').getContext('2d')!;
  const { width: W, height: H, fps } = project.settings;
  const laid = blocks.map((b) => {
    const fit = fitText(
      b,
      { w: W * 0.8, h: H * 0.62 },
      LINE_HEIGHT,
      (s, size) => measureText(ctx, s, 'hand', size, 1).w,
    );
    return { name: sceneNameFor(b), ...fit, box: measureText(ctx, fit.text, 'hand', fit.size, LINE_HEIGHT) };
  });
  // Golpe: el tempo de la primera música con ritmo, o 120 BPM.
  const bpm = project.assets.find((a) => a.beats)?.beats?.bpm ?? 120;
  const beat = Math.round((60 / bpm) * TICKS_PER_SECOND);
  const frame = ticksPerFrame(fps);
  let first = '';
  app.apply(`Crear ${blocks.length === 1 ? 'una escena' : `${blocks.length} escenas`} desde un guion`, (draft) => {
    let after = currentId;
    const current = findScene(draft, currentId);
    // Si la escena actual está vacía, el primer bloque va en ella.
    let reuse = current.layers.every((l) => layerItemCount(l) === 0);
    for (const d of laid) {
      const id = reuse ? currentId : addScene(draft, after);
      reuse = false;
      after = id;
      first ||= id;
      const scene = findScene(draft, id);
      scene.name = d.name;
      const t = createText(W / 2 - d.box.w / 2, H / 2 - d.box.h / 2, {
        text: d.text,
        font: 'hand',
        size: d.size,
        color: INK,
        align: 'center',
        lineHeight: LINE_HEIGHT,
        w: d.box.w,
        h: d.box.h,
      });
      t.in = Math.round(0.3 * TICKS_PER_SECOND);
      t.enter = { kind: 'draw', duration: writingDuration(d.text) };
      if (reveal !== 'letters') t.reveal = reveal;
      if (outlined) {
        // Letras que se leen sobre cualquier fondo o dibujo.
        t.outline = { color: '#ffffff', width: 0.08 };
        t.shadow = true;
      }
      const layer = scene.layers.find((l) => l.kind === 'vector') ?? scene.layers[0]!;
      (layer.items ??= []).push(t);
      const end = t.in + scriptSceneDuration(d.text, reveal === 'beat-words', beat);
      scene.duration = Math.ceil(end / frame) * frame;
    }
  });
  if (first) goToScene(first);
}

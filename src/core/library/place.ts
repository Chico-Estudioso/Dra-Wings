// Colocar recursos en la hoja: escala uniforme y posición por centro o por base.
import { fixed } from '../anim/animated';
import type { Group, Item } from '../model/types';
import { LIBRARY } from './catalog';
import { buildCharacter, CHARACTER_PRESETS } from './character';
import { INK, Sketch } from './sketch';

export interface Placement {
  /** Centro horizontal (unidades de escena). */
  cx: number;
  /** Centro vertical; si se da `bottom`, se ignora. */
  cy?: number;
  /** Base del recurso (por ejemplo, la línea del suelo). */
  bottom?: number;
  /** Alto deseado en unidades de escena. */
  height: number;
}

export function placeGroup(g: Group, p: Placement): Group {
  const scale = g.h > 0 ? p.height / g.h : 1;
  const cy = p.bottom !== undefined ? p.bottom - (g.h * scale) / 2 : (p.cy ?? 0);
  g.transform.scaleX = fixed(scale);
  g.transform.scaleY = fixed(scale);
  g.transform.x = fixed(p.cx - g.transform.anchorX);
  g.transform.y = fixed(cy - g.transform.anchorY);
  return g;
}

export function buildAsset(id: string): Group {
  const a = LIBRARY.find((x) => x.id === id);
  if (!a) throw new Error(`Recurso desconocido: ${id}`);
  return a.build();
}

export interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  build(w: number, h: number): Item[];
}

type Spec = [id: string, cx: number, y: number, height: number, mode?: 'center' | 'bottom'];

function fromSpecs(specs: Spec[], w: number, h: number, ground?: number): Item[] {
  const items: Item[] = [];
  if (ground !== undefined) {
    const s = new Sketch('suelo');
    s.line(
      [
        [w * 0.02, h * ground],
        [w * 0.35, h * (ground - 0.008)],
        [w * 0.7, h * (ground + 0.006)],
        [w * 0.98, h * ground],
      ],
      { size: Math.max(4, h * 0.006), color: INK },
    );
    items.push(...s.items);
  }
  for (const [id, cx, y, height, mode = 'bottom'] of specs) {
    const g = id.startsWith('personaje-')
      ? (() => {
          const preset = CHARACTER_PRESETS.find((p) => `personaje-${p.id}` === id)!;
          return { ...buildCharacter(preset.options), name: preset.name };
        })()
      : buildAsset(id);
    items.push(
      placeGroup(
        g,
        mode === 'bottom'
          ? { cx: cx * w, bottom: y * h, height: height * h }
          : { cx: cx * w, cy: y * h, height: height * h },
      ),
    );
  }
  return items;
}

export const TEMPLATES: SceneTemplate[] = [
  {
    id: 'campo',
    name: 'Casa en el campo',
    description: 'Casa, árbol, sol y nubes sobre una línea de suelo.',
    build: (w, h) =>
      fromSpecs(
        [
          ['nube', 0.2, 0.17, 0.13, 'center'],
          ['nube', 0.58, 0.12, 0.1, 'center'],
          ['sol', 0.86, 0.18, 0.24, 'center'],
          ['casa', 0.32, 0.82, 0.44],
          ['arbol', 0.64, 0.82, 0.5],
          ['flor', 0.8, 0.84, 0.14],
        ],
        w,
        h,
        0.82,
      ),
  },
  {
    id: 'ciudad',
    name: 'Ciudad',
    description: 'Edificios, una tienda y un coche.',
    build: (w, h) =>
      fromSpecs(
        [
          ['nube', 0.72, 0.15, 0.11, 'center'],
          ['edificio', 0.14, 0.84, 0.62],
          ['edificio', 0.3, 0.84, 0.5],
          ['tienda', 0.53, 0.84, 0.4],
          ['coche', 0.8, 0.86, 0.2],
        ],
        w,
        h,
        0.84,
      ),
  },
  {
    id: 'clase',
    name: 'En clase',
    description: 'Pizarra, mesa, mochila y un personaje.',
    build: (w, h) =>
      fromSpecs(
        [
          ['pizarra', 0.45, 0.4, 0.5, 'center'],
          ['mesa', 0.3, 0.9, 0.28],
          ['mochila', 0.12, 0.9, 0.2],
          ['personaje-alex', 0.8, 0.92, 0.62],
        ],
        w,
        h,
      ),
  },
  {
    id: 'noche',
    name: 'De noche',
    description: 'Luna, estrellas, casa y pinos.',
    build: (w, h) =>
      fromSpecs(
        [
          ['luna', 0.82, 0.2, 0.24, 'center'],
          ['estrella', 0.15, 0.15, 0.08, 'center'],
          ['estrella', 0.35, 0.1, 0.06, 'center'],
          ['estrella', 0.6, 0.18, 0.07, 'center'],
          ['casa', 0.35, 0.82, 0.42],
          ['pino', 0.62, 0.82, 0.46],
          ['pino', 0.75, 0.82, 0.36],
        ],
        w,
        h,
        0.82,
      ),
  },
  {
    id: 'conversacion',
    name: 'Conversación',
    description: 'Dos personajes con bocadillos de diálogo.',
    build: (w, h) =>
      fromSpecs(
        [
          ['personaje-lucia', 0.3, 0.95, 0.6],
          ['personaje-omar', 0.7, 0.95, 0.6],
          ['bocadillo', 0.2, 0.18, 0.24, 'center'],
          ['bocadillo', 0.82, 0.18, 0.24, 'center'],
        ],
        w,
        h,
      ),
  },
];

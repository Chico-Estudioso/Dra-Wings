// Constructor de personajes original, estilo Draw My Life: cabeza y torso con contorno de tinta,
// extremidades de trazo grueso y piezas intercambiables. Todo es vectorial y recoloreable.
import type { Group, Item } from '../model/types';
import type { Ticks } from '../time/ticks';
import { valueAt } from '../anim/animated';
import { variantAt } from '../anim/swaps';
import { setChildrenFrom, shiftItem } from '../edit/group';
import { ellipsePoints, INK, Sketch, type Pt } from './sketch';

export const HAIR_STYLES = {
  corto: 'Corto',
  largo: 'Largo',
  coleta: 'Coleta',
  rizado: 'Rizado',
  calvo: 'Sin pelo',
  gorra: 'Gorra',
} as const;
export const EXPRESSIONS = {
  feliz: 'Feliz',
  risa: 'Risa',
  neutral: 'Neutral',
  triste: 'Triste',
  sorpresa: 'Sorpresa',
  enfado: 'Enfado',
} as const;
export const POSES = {
  'de-pie': 'De pie',
  saludando: 'Saludando',
  'brazos-arriba': 'Brazos arriba',
  caminando: 'Caminando',
  senalando: 'Señalando',
  pensando: 'Pensando',
} as const;

export const SKIN_TONES = ['#f6d7b8', '#f2c9a0', '#dca878', '#b77b4f', '#8a5636', '#5e3a25'];
export const HAIR_COLORS = ['#1d1d1f', '#5b3a29', '#8a5a3b', '#d9a441', '#c4562b', '#9a9a9a'];
export const CLOTHES_COLORS = ['#2f6fd6', '#c23b4e', '#3f8f4f', '#e0a526', '#7b4bb7', '#d9622b', '#2a2f45', '#6b665c'];

export type HairStyle = keyof typeof HAIR_STYLES;
export type Expression = keyof typeof EXPRESSIONS;
export type Pose = keyof typeof POSES;

export interface CharacterOptions {
  hair: HairStyle;
  expression: Expression;
  pose: Pose;
  skin: string;
  hairColor: string;
  shirt: string;
  pants: string;
}

export const DEFAULT_CHARACTER: CharacterOptions = {
  hair: 'corto',
  expression: 'feliz',
  pose: 'de-pie',
  skin: SKIN_TONES[1]!,
  hairColor: HAIR_COLORS[1]!,
  shirt: CLOTHES_COLORS[0]!,
  pants: CLOTHES_COLORS[6]!,
};

// Geometría base (unidades del dibujo).
const HEAD = { cx: 100, cy: 70, rx: 42, ry: 46 };
const EYE_L: Pt = [84, 68];
const EYE_R: Pt = [116, 68];
const SHOULDER_L: Pt = [72, 136];
const SHOULDER_R: Pt = [128, 136];
const HIP_L: Pt = [86, 238];
const HIP_R: Pt = [114, 238];

type Limb = Pt[];
const POSE_LIMBS: Record<Pose, { armL: Limb; armR: Limb; legL: Limb; legR: Limb }> = {
  'de-pie': {
    armL: [SHOULDER_L, [58, 188], [54, 232]],
    armR: [SHOULDER_R, [142, 188], [146, 232]],
    legL: [HIP_L, [84, 300], [82, 356]],
    legR: [HIP_R, [116, 300], [118, 356]],
  },
  saludando: {
    armL: [SHOULDER_L, [58, 188], [54, 232]],
    armR: [SHOULDER_R, [162, 112], [170, 62]],
    legL: [HIP_L, [84, 300], [82, 356]],
    legR: [HIP_R, [116, 300], [118, 356]],
  },
  'brazos-arriba': {
    armL: [SHOULDER_L, [44, 104], [34, 58]],
    armR: [SHOULDER_R, [156, 104], [166, 58]],
    legL: [HIP_L, [80, 300], [72, 356]],
    legR: [HIP_R, [120, 300], [128, 356]],
  },
  caminando: {
    armL: [SHOULDER_L, [52, 180], [38, 214]],
    armR: [SHOULDER_R, [140, 186], [156, 222]],
    legL: [HIP_L, [72, 298], [56, 354]],
    legR: [HIP_R, [126, 298], [142, 354]],
  },
  senalando: {
    armL: [SHOULDER_L, [58, 188], [54, 232]],
    armR: [SHOULDER_R, [172, 146], [210, 140]],
    legL: [HIP_L, [84, 300], [82, 356]],
    legR: [HIP_R, [116, 300], [118, 356]],
  },
  pensando: {
    armL: [SHOULDER_L, [76, 196], [118, 196]],
    armR: [SHOULDER_R, [156, 178], [124, 116]],
    legL: [HIP_L, [84, 300], [82, 356]],
    legR: [HIP_R, [116, 300], [118, 356]],
  },
};

function drawHairBack(s: Sketch, o: CharacterOptions) {
  const { cx, cy, rx } = HEAD;
  if (o.hair === 'largo') {
    s.fillPoly(
      [
        [cx - rx - 6, cy - 6],
        [cx - rx - 10, cy + 60],
        [cx - rx + 8, cy + 74],
        [cx + rx - 8, cy + 74],
        [cx + rx + 10, cy + 60],
        [cx + rx + 6, cy - 6],
      ],
      o.hairColor,
      'hair',
      true,
    );
  }
  if (o.hair === 'coleta') {
    s.fillPoly(ellipsePoints(cx + rx + 14, cy - 18, 16, 30, 20), o.hairColor, 'hair', true);
    s.ellipse(cx + rx + 14, cy - 18, 16, 30, { size: 3 });
  }
}

function drawHairFront(s: Sketch, o: CharacterOptions) {
  const { cx, cy, rx, ry } = HEAD;
  const cap = ellipsePoints(cx, cy, rx + 4, ry + 4, 18, Math.PI * 1.02, Math.PI * 1.98);
  switch (o.hair) {
    case 'corto':
    case 'largo':
    case 'coleta': {
      const fringe: Pt[] = [
        [cx + rx + 2, cy - 4],
        [cx + 28, cy - 26],
        [cx + 12, cy - 18],
        [cx - 2, cy - 30],
        [cx - 16, cy - 18],
        [cx - 30, cy - 26],
        [cx - rx - 2, cy - 4],
      ];
      s.fillPoly([...cap, ...fringe], o.hairColor, 'hair');
      s.line([...cap, fringe[0]!], { size: 3.5 });
      s.line(fringe, { size: 3 });
      break;
    }
    case 'rizado':
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (Math.PI * i) / 8;
        const x = cx + (rx + 2) * Math.cos(a);
        const y = cy - 6 + (ry - 2) * Math.sin(a);
        s.fillEllipse(x, y, 13, 13, o.hairColor, 'hair');
        s.arc(x, y, 13, 13, a - 1.6, a + 1.6, { size: 2.5 });
      }
      break;
    case 'gorra': {
      const top = cy - 18;
      const dome = ellipsePoints(cx, top, rx + 4, ry - 8, 16, Math.PI, Math.PI * 2);
      s.fillPoly([...dome, [cx + rx + 4, top], [cx - rx - 4, top]], o.hairColor, 'hair');
      const visor: Pt[] = [
        [cx + rx - 6, top - 4],
        [cx + rx + 38, top + 2],
        [cx + rx + 34, top + 8],
        [cx + rx - 8, top + 6],
      ];
      s.fillPoly(visor, o.hairColor, 'hair');
      s.line([...dome, [cx + rx + 4, top]], { size: 3.5 });
      s.line(
        [
          [cx - rx - 4, top + 2],
          [cx + rx - 6, top + 2],
        ],
        { size: 3 },
      );
      s.outline(visor, { size: 3 });
      break;
    }
    case 'calvo':
      s.arc(cx - rx + 4, cy - 2, 10, 14, Math.PI * 0.6, Math.PI * 1.4, { color: o.hairColor, size: 4, slot: 'hair' });
      s.arc(cx + rx - 4, cy - 2, 10, 14, -Math.PI * 0.4, Math.PI * 0.4, { color: o.hairColor, size: 4, slot: 'hair' });
      break;
  }
}

/** Ojos y cejas de cada expresión. */
function drawEyes(s: Sketch, e: Expression) {
  const [lx, ly] = EYE_L;
  const [rx, ry] = EYE_R;
  const eyeDots = () => {
    s.fillEllipse(lx, ly, 4.5, 5, INK);
    s.fillEllipse(rx, ry, 4.5, 5, INK);
  };
  switch (e) {
    case 'risa':
      s.arc(lx, ly + 3, 6, 6, Math.PI * 1.1, Math.PI * 1.9, { size: 3 });
      s.arc(rx, ry + 3, 6, 6, Math.PI * 1.1, Math.PI * 1.9, { size: 3 });
      break;
    case 'triste':
      eyeDots();
      s.line(
        [
          [76, 56],
          [90, 52],
        ],
        { size: 3 },
      );
      s.line(
        [
          [124, 56],
          [110, 52],
        ],
        { size: 3 },
      );
      break;
    case 'sorpresa':
      s.ellipse(lx, ly, 7, 8, { size: 2.5 });
      s.ellipse(rx, ry, 7, 8, { size: 2.5 });
      s.fillEllipse(lx, ly + 1, 3, 3, INK);
      s.fillEllipse(rx, ry + 1, 3, 3, INK);
      s.arc(lx, ly - 6, 8, 8, Math.PI * 1.2, Math.PI * 1.8, { size: 2.5 });
      s.arc(rx, ry - 6, 8, 8, Math.PI * 1.2, Math.PI * 1.8, { size: 2.5 });
      break;
    case 'enfado':
      eyeDots();
      s.line(
        [
          [74, 54],
          [92, 61],
        ],
        { size: 3.5 },
      );
      s.line(
        [
          [126, 54],
          [108, 61],
        ],
        { size: 3.5 },
      );
      break;
    default:
      eyeDots();
  }
}

/** Boca cerrada de cada expresión. */
function drawMouth(s: Sketch, e: Expression) {
  switch (e) {
    case 'feliz':
      s.arc(100, 84, 17, 13, Math.PI * 0.15, Math.PI * 0.85, { size: 3.5 });
      break;
    case 'risa':
      s.fillPoly(ellipsePoints(100, 90, 16, 15, 14, 0, Math.PI), '#7a2330');
      s.line([...ellipsePoints(100, 90, 16, 15, 14, 0, Math.PI), [84, 90]], { size: 3 });
      break;
    case 'neutral':
      s.line(
        [
          [89, 96],
          [111, 96],
        ],
        { size: 3.5 },
      );
      break;
    case 'triste':
      s.arc(100, 108, 14, 10, Math.PI * 1.15, Math.PI * 1.85, { size: 3.5 });
      break;
    case 'sorpresa':
      s.ellipse(100, 98, 6, 8, { size: 3 });
      break;
    case 'enfado':
      s.arc(100, 104, 12, 7, Math.PI * 1.15, Math.PI * 1.85, { size: 3.5 });
      break;
  }
}

/** Altura del centro de la boca de cada expresión (unidades del dibujo). */
const MOUTH_Y: Record<Expression, number> = {
  feliz: 92,
  risa: 94,
  neutral: 96,
  triste: 102,
  sorpresa: 98,
  enfado: 100,
};

/** Boca hablando: entreabierta o abierta (para sincronizar con la voz). */
export type Mouth = 'half' | 'open';

function drawTalkingMouth(s: Sketch, e: Expression, mouth: Mouth) {
  const y = MOUTH_Y[e];
  const [rx, ry] = mouth === 'open' ? [11, 9] : [10, 4.5];
  s.fillEllipse(100, y, rx, ry, '#7a2330');
  if (mouth === 'open') s.fillEllipse(100, y + ry * 0.45, rx * 0.55, ry * 0.4, '#e8908a');
  s.ellipse(100, y, rx, ry, { size: 3 });
}

/** Identificador del aspecto de un personaje: `pelo/expresión/postura`. */
export const lookId = (o: Pick<CharacterOptions, 'hair' | 'expression' | 'pose'>) =>
  `${o.hair}/${o.expression}/${o.pose}`;

export function buildCharacter(o: CharacterOptions, seed = 'personaje'): Group {
  const g = drawCharacter(o, seed).toGroup({ kind: 'character', id: lookId(o) }, 'Personaje', [
    { id: 'skin', label: 'Piel', color: o.skin },
    { id: 'hair', label: o.hair === 'gorra' ? 'Gorra' : 'Pelo', color: o.hairColor },
    { id: 'shirt', label: 'Camiseta', color: o.shirt },
    { id: 'pants', label: 'Pantalón', color: o.pants },
  ]);
  // Los personajes respiran: nunca se quedan muertos en pantalla.
  g.life = { kind: 'breathe', amount: 1 };
  return g;
}

/** Dibuja el personaje en las coordenadas del dibujo (sin agrupar). */
function drawCharacter(o: CharacterOptions, seed = 'personaje', mouth?: Mouth): Sketch {
  const s = new Sketch(`${seed}:${o.hair}:${o.expression}:${o.pose}`);
  const limbs = POSE_LIMBS[o.pose];
  const { cx, cy, rx, ry } = HEAD;

  drawHairBack(s, o);

  // Piernas (pantalón) y zapatos.
  for (const leg of [limbs.legL, limbs.legR]) {
    s.line(leg, { color: o.pants, size: 16, slot: 'pants', wobble: 0.3 });
    const [fx, fy] = leg[leg.length - 1]!;
    const dir = fx < 100 ? -1 : 1;
    s.fillEllipse(fx + dir * 6, fy + 4, 13, 7, INK);
  }

  // Torso (camiseta) con contorno.
  const torso: Pt[] = [
    [70, 128],
    [130, 128],
    [138, 242],
    [62, 242],
  ];
  s.fillPoly(torso, o.shirt, 'shirt');
  s.outline(torso, { size: 4 });

  // Brazos (piel) y manos.
  for (const arm of [limbs.armL, limbs.armR]) {
    s.line(arm, { color: o.skin, size: 11, slot: 'skin', wobble: 0.3 });
    const [hx, hy] = arm[arm.length - 1]!;
    s.fillEllipse(hx, hy, 8, 8, o.skin, 'skin');
    s.ellipse(hx, hy, 8, 8, { size: 2.5 });
  }
  // Mangas.
  s.line([limbs.armL[0]!, [(limbs.armL[0]![0] + limbs.armL[1]![0]) / 2, (limbs.armL[0]![1] + limbs.armL[1]![1]) / 2]], {
    color: o.shirt,
    size: 15,
    slot: 'shirt',
    wobble: 0.2,
  });
  s.line([limbs.armR[0]!, [(limbs.armR[0]![0] + limbs.armR[1]![0]) / 2, (limbs.armR[0]![1] + limbs.armR[1]![1]) / 2]], {
    color: o.shirt,
    size: 15,
    slot: 'shirt',
    wobble: 0.2,
  });

  // Cuello y cabeza.
  s.line(
    [
      [100, 112],
      [100, 130],
    ],
    { color: o.skin, size: 14, slot: 'skin', wobble: 0.1 },
  );
  s.fillEllipse(cx - rx, cy + 4, 7, 10, o.skin, 'skin');
  s.fillEllipse(cx + rx, cy + 4, 7, 10, o.skin, 'skin');
  s.fillEllipse(cx, cy, rx, ry, o.skin, 'skin');
  s.ellipse(cx, cy, rx, ry, { size: 4 });
  s.fillEllipse(78, 84, 7, 4, '#e8908a');
  s.fillEllipse(122, 84, 7, 4, '#e8908a');

  drawEyes(s, o.expression);
  // La boca cerrada se dibuja siempre (así el temblor del resto del dibujo no cambia); hablando, se
  // quita y se pone la abierta encima de todo.
  const before = s.items.length;
  drawMouth(s, o.expression);
  if (mouth) s.items.splice(before);
  drawHairFront(s, o);
  if (mouth) drawTalkingMouth(s, o.expression, mouth);
  return s;
}

/**
 * Opciones del personaje tal como se ve en `t` (aspecto del instante y colores actuales de sus
 * ranuras). Null si el grupo no es un personaje del constructor.
 */
export function characterOptions(group: Group, t: Ticks): CharacterOptions | null {
  if (group.source?.kind !== 'character') return null;
  const [hair, expression, pose] = (variantAt(group, t) ?? '').split('/');
  if (!(hair! in HAIR_STYLES) || !(expression! in EXPRESSIONS) || !(pose! in POSES)) return null;
  const color = (slot: string, fallback: string) => group.slots?.find((s) => s.id === slot)?.color ?? fallback;
  return {
    hair: hair as HairStyle,
    expression: expression as Expression,
    pose: pose as Pose,
    skin: color('skin', DEFAULT_CHARACTER.skin),
    hairColor: color('hair', DEFAULT_CHARACTER.hairColor),
    shirt: color('shirt', DEFAULT_CHARACTER.shirt),
    pants: color('pants', DEFAULT_CHARACTER.pants),
  };
}

const talking = new WeakMap<Group, Map<string, Item[]>>();

/**
 * Dibujo del personaje con la boca hablando (entreabierta o abierta), con su aspecto en `t` y el
 * mismo encuadre que el original. Null si no es un personaje del constructor.
 */
export function talkingChildren(group: Group, t: Ticks, mouth: Mouth): Item[] | null {
  const o = characterOptions(group, t);
  const stroke = group.children.find((c) => c.type === 'stroke');
  if (!o || !stroke) return null;
  let cache = talking.get(group);
  if (!cache) talking.set(group, (cache = new Map()));
  const key = `${lookId(o)}:${mouth}`;
  let children = cache.get(key);
  if (!children) {
    // Mismo desplazamiento que el resto de dibujos del grupo (ver setCharacterLook).
    const dx = valueAt(stroke.transform.x, 0);
    const dy = valueAt(stroke.transform.y, 0);
    children = drawCharacter(o, 'personaje', mouth).items;
    for (const c of children) shiftItem(c, dx, dy);
    cache.set(key, children);
  }
  return children;
}

/**
 * Cambia la expresión o la postura del personaje desde `t` (hasta su siguiente cambio; en su
 * aparición o antes, desde el principio). El dibujo nuevo se coloca con el mismo encuadre que el
 * original. Devuelve si se pudo.
 */
export function setCharacterLook(
  group: Group,
  t: Ticks,
  look: Partial<Pick<CharacterOptions, 'expression' | 'pose'>>,
): boolean {
  const current = characterOptions(group, t);
  // Todos los trazos del dibujo nacen en el origen: su posición dice dónde está el origen del dibujo.
  const stroke = group.children.find((c) => c.type === 'stroke');
  if (!current || !stroke) return false;
  const dx = valueAt(stroke.transform.x, 0);
  const dy = valueAt(stroke.transform.y, 0);
  const next = { ...current, ...look };
  const children = drawCharacter(next).items;
  for (const c of children) shiftItem(c, dx, dy);
  setChildrenFrom(group, Math.max(t, group.in), children, lookId(next));
  return true;
}

export const CHARACTER_PRESETS: { id: string; name: string; options: CharacterOptions }[] = [
  { id: 'alex', name: 'Alex', options: DEFAULT_CHARACTER },
  {
    id: 'lucia',
    name: 'Lucía',
    options: {
      ...DEFAULT_CHARACTER,
      hair: 'largo',
      skin: SKIN_TONES[0]!,
      hairColor: HAIR_COLORS[4]!,
      shirt: CLOTHES_COLORS[1]!,
      pose: 'saludando',
    },
  },
  {
    id: 'omar',
    name: 'Omar',
    options: {
      ...DEFAULT_CHARACTER,
      hair: 'rizado',
      skin: SKIN_TONES[4]!,
      hairColor: HAIR_COLORS[0]!,
      shirt: CLOTHES_COLORS[3]!,
      expression: 'risa',
    },
  },
  {
    id: 'marta',
    name: 'Marta',
    options: {
      ...DEFAULT_CHARACTER,
      hair: 'coleta',
      skin: SKIN_TONES[2]!,
      hairColor: HAIR_COLORS[3]!,
      shirt: CLOTHES_COLORS[2]!,
      pose: 'senalando',
    },
  },
  {
    id: 'abuelo',
    name: 'Abuelo',
    options: {
      ...DEFAULT_CHARACTER,
      hair: 'calvo',
      skin: SKIN_TONES[1]!,
      hairColor: HAIR_COLORS[5]!,
      shirt: CLOTHES_COLORS[7]!,
      expression: 'neutral',
      pose: 'pensando',
    },
  },
  {
    id: 'leo',
    name: 'Leo',
    options: {
      ...DEFAULT_CHARACTER,
      hair: 'gorra',
      skin: SKIN_TONES[3]!,
      hairColor: CLOTHES_COLORS[0]!,
      shirt: CLOTHES_COLORS[5]!,
      expression: 'sorpresa',
      pose: 'brazos-arriba',
    },
  },
];

// Catálogo de recursos originales de la biblioteca. Todos se dibujan por código (licencia del
// propio proyecto) en una caja de unos 200 × 200 unidades y se insertan como grupos editables.
import type { ColorSlot, Group } from '../model/types';
import { buildCharacter, CHARACTER_PRESETS } from './character';
import { ellipsePoints, INK, Sketch, type Pt } from './sketch';

export type CategoryId = 'personajes' | 'edificios' | 'naturaleza' | 'objetos' | 'vehiculos' | 'simbolos';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'personajes', label: 'Personajes' },
  { id: 'edificios', label: 'Casas y edificios' },
  { id: 'naturaleza', label: 'Naturaleza' },
  { id: 'objetos', label: 'Objetos' },
  { id: 'vehiculos', label: 'Vehículos' },
  { id: 'simbolos', label: 'Símbolos' },
];

export interface LibraryAsset {
  id: string;
  name: string;
  category: CategoryId;
  tags: string[];
  /** Proporción del alto de la hoja que ocupa al insertarlo. */
  size: number;
  build(): Group;
}

const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

function roundRect(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const pts: Pt[] = [];
  const corner = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= 4; i++) {
      const a = from + (Math.PI / 2) * (i / 4);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return pts;
}

function star(cx: number, cy: number, r1: number, r2: number, n = 5): Pt[] {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    const r = i % 2 ? r2 : r1;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

function heart(cx: number, cy: number, s: number): Pt[] {
  return Array.from({ length: 40 }, (_, i) => {
    const t = (i / 40) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [cx + (x * s) / 16, cy - (y * s) / 16] as Pt;
  });
}

function blob(cx: number, cy: number, rx: number, ry: number, bumps: number, depth: number, phase = 0): Pt[] {
  return Array.from({ length: bumps * 6 }, (_, i) => {
    const a = (i / (bumps * 6)) * Math.PI * 2;
    const k = 1 + depth * Math.abs(Math.sin((a * bumps) / 2 + phase));
    return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)] as Pt;
  });
}

function asset(
  id: string,
  name: string,
  category: CategoryId,
  tags: string[],
  size: number,
  draw: (s: Sketch) => void,
  slots?: ColorSlot[],
): LibraryAsset {
  return {
    id,
    name,
    category,
    tags,
    size,
    build: () => {
      const s = new Sketch(id);
      draw(s);
      return s.toGroup(
        { kind: 'library', id },
        name,
        slots?.map((x) => ({ ...x })),
      );
    },
  };
}

const P = (label: string, color: string): ColorSlot => ({ id: 'primary', label, color });
const S = (label: string, color: string): ColorSlot => ({ id: 'secondary', label, color });

const BUILDINGS: LibraryAsset[] = [
  asset(
    'casa',
    'Casa',
    'edificios',
    ['hogar', 'vivienda', 'familia'],
    0.42,
    (s) => {
      s.fillPoly(rect(30, 90, 140, 110), '#f1d9a8', 'primary');
      s.fillPoly(
        [
          [18, 95],
          [100, 25],
          [182, 95],
        ],
        '#c4562b',
        'secondary',
      );
      s.fillPoly(rect(128, 32, 18, 40), '#8a5a3b');
      s.fillPoly(rect(86, 140, 30, 60), '#8a5a3b');
      s.fillPoly(rect(44, 118, 30, 28), '#bfe1f2');
      s.fillPoly(rect(128, 118, 30, 28), '#bfe1f2');
      s.outline(rect(128, 32, 18, 40), { size: 3 });
      s.line(
        [
          [18, 95],
          [100, 25],
          [182, 95],
          [18, 95],
        ],
        { size: 4.5 },
      );
      s.outline(rect(30, 95, 140, 105), { size: 4.5 });
      s.outline(rect(86, 140, 30, 60), { size: 3.5 });
      s.fillEllipse(109, 172, 3, 3, INK);
      for (const x of [44, 128]) {
        s.outline(rect(x, 118, 30, 28), { size: 3 });
        s.line(
          [
            [x + 15, 118],
            [x + 15, 146],
          ],
          { size: 2.5 },
        );
        s.line(
          [
            [x, 132],
            [x + 30, 132],
          ],
          { size: 2.5 },
        );
      }
    },
    [P('Pared', '#f1d9a8'), S('Tejado', '#c4562b')],
  ),
  asset(
    'edificio',
    'Edificio',
    'edificios',
    ['ciudad', 'pisos', 'oficina'],
    0.6,
    (s) => {
      s.fillPoly(rect(50, 10, 100, 190), '#a8b4c0', 'primary');
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 3; c++) s.fillPoly(rect(62 + c * 28, 24 + r * 26, 18, 16), '#f4e6a6', 'secondary');
      s.fillPoly(rect(86, 172, 28, 28), '#5a6470');
      s.outline(rect(50, 10, 100, 190), { size: 4.5 });
      for (let r = 0; r < 6; r++)
        s.line(
          [
            [60, 40 + r * 26],
            [140, 40 + r * 26],
          ],
          { size: 1.5, color: '#6b665c' },
        );
      s.outline(rect(86, 172, 28, 28), { size: 3 });
    },
    [P('Fachada', '#a8b4c0'), S('Ventanas', '#f4e6a6')],
  ),
  asset(
    'escuela',
    'Escuela',
    'edificios',
    ['colegio', 'clase', 'estudiar'],
    0.45,
    (s) => {
      s.fillPoly(rect(15, 80, 170, 115), '#e8b07a', 'primary');
      s.fillPoly(
        [
          [5, 85],
          [100, 35],
          [195, 85],
        ],
        '#b8433a',
        'secondary',
      );
      s.fillPoly(rect(84, 140, 32, 55), '#6b4a33');
      for (const x of [30, 140]) s.fillPoly(rect(x, 105, 30, 26), '#bfe1f2');
      s.fillEllipse(100, 68, 13, 13, '#ffffff');
      s.line(
        [
          [5, 85],
          [100, 35],
          [195, 85],
          [5, 85],
        ],
        { size: 4.5 },
      );
      s.outline(rect(15, 85, 170, 110), { size: 4.5 });
      s.outline(rect(84, 140, 32, 55), { size: 3.5 });
      for (const x of [30, 140]) s.outline(rect(x, 105, 30, 26), { size: 3 });
      s.ellipse(100, 68, 13, 13, { size: 3 });
      s.line(
        [
          [100, 68],
          [100, 60],
        ],
        { size: 2.5 },
      );
      s.line(
        [
          [100, 68],
          [106, 70],
        ],
        { size: 2.5 },
      );
      s.line(
        [
          [100, 35],
          [100, 5],
        ],
        { size: 3 },
      );
      s.fillPoly(
        [
          [100, 5],
          [128, 12],
          [100, 20],
        ],
        '#3f8f4f',
      );
      s.line(
        [
          [100, 5],
          [128, 12],
          [100, 20],
        ],
        { size: 2.5 },
      );
    },
    [P('Pared', '#e8b07a'), S('Tejado', '#b8433a')],
  ),
  asset(
    'tienda',
    'Tienda',
    'edificios',
    ['comprar', 'mercado', 'negocio'],
    0.42,
    (s) => {
      s.fillPoly(rect(25, 60, 150, 140), '#f3ead7', 'primary');
      for (let i = 0; i < 6; i++)
        s.fillPoly(rect(20 + i * 26.6, 60, 26.6, 26), i % 2 ? '#ffffff' : '#c23b4e', i % 2 ? undefined : 'secondary');
      s.fillPoly(rect(45, 110, 60, 50), '#bfe1f2');
      s.fillPoly(rect(122, 120, 34, 80), '#8a5a3b');
      s.fillPoly(rect(55, 25, 90, 28), '#ffffff');
      s.outline(rect(25, 60, 150, 140), { size: 4.5 });
      s.line(
        [
          [20, 60],
          [180, 60],
          [180, 86],
          [20, 86],
          [20, 60],
        ],
        { size: 3.5 },
      );
      s.outline(rect(45, 110, 60, 50), { size: 3 });
      s.outline(rect(122, 120, 34, 80), { size: 3 });
      s.outline(rect(55, 25, 90, 28), { size: 3 });
      s.line(
        [
          [70, 39],
          [130, 39],
        ],
        { size: 3, color: '#c23b4e' },
      );
    },
    [P('Pared', '#f3ead7'), S('Toldo', '#c23b4e')],
  ),
];

const NATURE: LibraryAsset[] = [
  asset(
    'arbol',
    'Árbol',
    'naturaleza',
    ['bosque', 'parque', 'campo'],
    0.5,
    (s) => {
      s.fillPoly(
        [
          [88, 200],
          [92, 120],
          [108, 120],
          [114, 200],
        ],
        '#8a5a3b',
        'secondary',
      );
      s.line(
        [
          [88, 200],
          [92, 120],
        ],
        { size: 4 },
      );
      s.line(
        [
          [114, 200],
          [108, 120],
        ],
        { size: 4 },
      );
      const crown = blob(100, 80, 70, 62, 7, 0.12);
      s.fillPoly(crown, '#4f9d55', 'primary', true);
      s.outline(crown, { size: 4.5 });
    },
    [P('Copa', '#4f9d55'), S('Tronco', '#8a5a3b')],
  ),
  asset(
    'pino',
    'Pino',
    'naturaleza',
    ['bosque', 'montaña', 'navidad'],
    0.5,
    (s) => {
      s.fillPoly(rect(92, 170, 16, 30), '#8a5a3b');
      for (const [y, w] of [
        [120, 75],
        [80, 60],
        [42, 44],
      ] as const) {
        const tri: Pt[] = [
          [100 - w, y + 55],
          [100, y - 10],
          [100 + w, y + 55],
        ];
        s.fillPoly(tri, '#2f7a46', 'primary');
        s.outline(tri, { size: 4 });
      }
      s.outline(rect(92, 175, 16, 25), { size: 3 });
    },
    [P('Hojas', '#2f7a46')],
  ),
  asset(
    'flor',
    'Flor',
    'naturaleza',
    ['jardín', 'primavera', 'regalo'],
    0.25,
    (s) => {
      s.quad([100, 200], [92, 140], [100, 95], { color: '#3f8f4f', size: 6 });
      const leaf = ellipsePoints(80, 160, 18, 8, 16);
      s.fillPoly(leaf, '#5fae5f', undefined, true);
      s.outline(leaf, { size: 2.5 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pts = ellipsePoints(100 + 26 * Math.cos(a), 70 + 26 * Math.sin(a), 18, 18, 14);
        s.fillPoly(pts, '#e86a92', 'primary', true);
        s.outline(pts, { size: 2.5 });
      }
      s.fillEllipse(100, 70, 16, 16, '#f2c14e');
      s.ellipse(100, 70, 16, 16, { size: 3 });
    },
    [P('Pétalos', '#e86a92')],
  ),
  asset(
    'sol',
    'Sol',
    'naturaleza',
    ['día', 'verano', 'calor'],
    0.28,
    (s) => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        s.line(
          [
            [100 + 58 * Math.cos(a), 100 + 58 * Math.sin(a)],
            [100 + 86 * Math.cos(a), 100 + 86 * Math.sin(a)],
          ],
          {
            size: 5,
            color: '#e0a526',
            slot: 'primary',
          },
        );
      }
      s.fillEllipse(100, 100, 46, 46, '#f6c945', 'primary');
      s.ellipse(100, 100, 46, 46, { size: 4.5 });
    },
    [P('Sol', '#f6c945')],
  ),
  asset(
    'nube',
    'Nube',
    'naturaleza',
    ['cielo', 'tiempo', 'lluvia'],
    0.22,
    (s) => {
      const c = blob(100, 100, 85, 42, 5, 0.25, 0.4);
      s.fillPoly(c, '#ffffff', 'primary', true);
      s.outline(c, { size: 4 });
    },
    [P('Nube', '#ffffff')],
  ),
  asset(
    'montana',
    'Montañas',
    'naturaleza',
    ['paisaje', 'viaje', 'naturaleza'],
    0.45,
    (s) => {
      const m1: Pt[] = [
        [0, 190],
        [70, 60],
        [140, 190],
      ];
      const m2: Pt[] = [
        [70, 190],
        [140, 30],
        [210, 190],
      ];
      s.fillPoly(m1, '#8e9aa6', 'primary');
      s.fillPoly(m2, '#7a8794', 'primary');
      s.fillPoly(
        [
          [140, 30],
          [122, 70],
          [134, 64],
          [146, 74],
          [158, 70],
        ],
        '#ffffff',
      );
      s.outline(m1, { size: 4 });
      s.outline(m2, { size: 4 });
    },
    [P('Roca', '#8e9aa6')],
  ),
  asset(
    'luna',
    'Luna',
    'naturaleza',
    ['noche', 'dormir', 'cielo'],
    0.22,
    (s) => {
      const outer = ellipsePoints(100, 100, 70, 70, 30, Math.PI * 0.3, Math.PI * 1.7);
      const inner = ellipsePoints(130, 100, 52, 52, 24, Math.PI * 1.3, Math.PI * 0.7);
      const shape = [...outer, ...inner];
      s.fillPoly(shape, '#f4e08a', 'primary');
      s.outline(shape, { size: 4 });
    },
    [P('Luna', '#f4e08a')],
  ),
  asset(
    'estrella',
    'Estrella',
    'naturaleza',
    ['noche', 'premio', 'brillo'],
    0.18,
    (s) => {
      const st = star(100, 105, 90, 38);
      s.fillPoly(st, '#f6c945', 'primary');
      s.outline(st, { size: 4.5 });
    },
    [P('Estrella', '#f6c945')],
  ),
];

const OBJECTS: LibraryAsset[] = [
  asset(
    'libro',
    'Libro',
    'objetos',
    ['leer', 'estudiar', 'escuela'],
    0.22,
    (s) => {
      const left: Pt[] = [
        [100, 60],
        [20, 45],
        [20, 165],
        [100, 180],
      ];
      const right: Pt[] = [
        [100, 60],
        [180, 45],
        [180, 165],
        [100, 180],
      ];
      s.fillPoly(left, '#ffffff');
      s.fillPoly(right, '#ffffff');
      s.fillPoly(
        [
          [20, 165],
          [100, 180],
          [180, 165],
          [180, 175],
          [100, 192],
          [20, 175],
        ],
        '#c23b4e',
        'primary',
      );
      s.outline(left, { size: 4 });
      s.outline(right, { size: 4 });
      s.line(
        [
          [20, 175],
          [100, 192],
          [180, 175],
        ],
        { size: 3.5 },
      );
      for (let i = 0; i < 4; i++) {
        s.line(
          [
            [34, 75 + i * 22],
            [88, 85 + i * 22],
          ],
          { size: 2, color: '#9a9a9a' },
        );
        s.line(
          [
            [112, 85 + i * 22],
            [166, 75 + i * 22],
          ],
          { size: 2, color: '#9a9a9a' },
        );
      }
    },
    [P('Tapa', '#c23b4e')],
  ),
  asset(
    'movil',
    'Teléfono móvil',
    'objetos',
    ['llamar', 'mensaje', 'redes'],
    0.22,
    (s) => {
      const body = roundRect(55, 10, 90, 180, 16);
      s.fillPoly(body, '#2a2f45', 'primary');
      s.fillPoly(rect(64, 30, 72, 130), '#bfe1f2');
      s.outline(body, { size: 4 });
      s.fillEllipse(100, 175, 6, 6, '#6b665c');
      s.fillPoly(roundRect(74, 50, 44, 18, 8), '#ffffff');
      s.fillPoly(roundRect(84, 80, 44, 18, 8), '#7fd18b');
    },
    [P('Carcasa', '#2a2f45')],
  ),
  asset(
    'portatil',
    'Ordenador portátil',
    'objetos',
    ['trabajo', 'internet', 'estudiar'],
    0.3,
    (s) => {
      s.fillPoly(rect(40, 30, 120, 85), '#3a3f55', 'primary');
      s.fillPoly(rect(50, 40, 100, 65), '#bfe1f2');
      s.fillPoly(
        [
          [25, 125],
          [175, 125],
          [190, 150],
          [10, 150],
        ],
        '#9aa5b1',
        'primary',
      );
      s.outline(rect(40, 30, 120, 85), { size: 4 });
      s.line(
        [
          [40, 115],
          [25, 125],
          [10, 150],
          [190, 150],
          [175, 125],
          [160, 115],
        ],
        { size: 4 },
      );
      s.line(
        [
          [80, 138],
          [120, 138],
        ],
        { size: 3 },
      );
    },
    [P('Cuerpo', '#9aa5b1')],
  ),
  asset(
    'taza',
    'Taza',
    'objetos',
    ['café', 'desayuno', 'bebida'],
    0.2,
    (s) => {
      const cup: Pt[] = [
        [45, 70],
        [145, 70],
        [135, 185],
        [55, 185],
      ];
      s.fillPoly(cup, '#e86a4a', 'primary');
      s.outline(cup, { size: 4.5 });
      s.arc(150, 115, 26, 28, -Math.PI / 2, Math.PI / 2, { size: 5 });
      s.fillEllipse(95, 72, 48, 8, '#6b3e26');
      s.quad([75, 55], [65, 35], [80, 15], { size: 3, color: '#9a9a9a' });
      s.quad([105, 55], [95, 35], [110, 15], { size: 3, color: '#9a9a9a' });
    },
    [P('Taza', '#e86a4a')],
  ),
  asset(
    'regalo',
    'Regalo',
    'objetos',
    ['cumpleaños', 'sorpresa', 'fiesta'],
    0.25,
    (s) => {
      s.fillPoly(rect(35, 90, 130, 105), '#7b4bb7', 'primary');
      s.fillPoly(rect(25, 65, 150, 30), '#7b4bb7', 'primary');
      s.fillPoly(rect(90, 65, 20, 130), '#f6c945', 'secondary');
      s.outline(rect(35, 95, 130, 100), { size: 4 });
      s.outline(rect(25, 65, 150, 30), { size: 4 });
      s.outline(rect(90, 65, 20, 130), { size: 3 });
      s.ellipse(78, 48, 22, 14, { size: 4, color: '#e0a526' });
      s.ellipse(122, 48, 22, 14, { size: 4, color: '#e0a526' });
    },
    [P('Papel', '#7b4bb7'), S('Lazo', '#f6c945')],
  ),
  asset(
    'reloj',
    'Reloj',
    'objetos',
    ['tiempo', 'hora', 'prisa'],
    0.22,
    (s) => {
      s.fillEllipse(100, 100, 85, 85, '#ffffff');
      s.ellipse(100, 100, 85, 85, { size: 6, color: '#2a2f45', slot: 'primary' });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        s.line(
          [
            [100 + 66 * Math.cos(a), 100 + 66 * Math.sin(a)],
            [100 + 76 * Math.cos(a), 100 + 76 * Math.sin(a)],
          ],
          { size: 3.5 },
        );
      }
      s.line(
        [
          [100, 100],
          [100, 48],
        ],
        { size: 5 },
      );
      s.line(
        [
          [100, 100],
          [138, 118],
        ],
        { size: 5 },
      );
      s.fillEllipse(100, 100, 6, 6, INK);
    },
    [P('Marco', '#2a2f45')],
  ),
  asset(
    'bombilla',
    'Bombilla',
    'objetos',
    ['idea', 'pensar', 'creatividad'],
    0.25,
    (s) => {
      const bulb = [
        ...ellipsePoints(100, 80, 55, 55, 26, Math.PI * 0.75, Math.PI * 2.25),
        [125, 150],
        [75, 150],
      ] as Pt[];
      s.fillPoly(bulb, '#f9e27a', 'primary', true);
      s.outline(bulb, { size: 4.5 });
      s.fillPoly(rect(75, 150, 50, 30), '#9aa5b1');
      s.outline(rect(75, 150, 50, 30), { size: 3.5 });
      s.line(
        [
          [75, 160],
          [125, 160],
        ],
        { size: 2.5 },
      );
      s.line(
        [
          [75, 170],
          [125, 170],
        ],
        { size: 2.5 },
      );
      s.line(
        [
          [88, 110],
          [95, 90],
          [105, 90],
          [112, 110],
        ],
        { size: 3, color: '#e0a526' },
      );
      for (const a of [-2.4, -1.57, -0.75])
        s.line(
          [
            [100 + 66 * Math.cos(a), 80 + 66 * Math.sin(a)],
            [100 + 86 * Math.cos(a), 80 + 86 * Math.sin(a)],
          ],
          { size: 4, color: '#e0a526' },
        );
    },
    [P('Luz', '#f9e27a')],
  ),
  asset(
    'corazon',
    'Corazón',
    'objetos',
    ['amor', 'amistad', 'cariño'],
    0.2,
    (s) => {
      const h = heart(100, 100, 85);
      s.fillPoly(h, '#d9364f', 'primary', true);
      s.outline(h, { size: 4.5 });
      s.arc(70, 72, 16, 16, Math.PI * 1.1, Math.PI * 1.5, { size: 4, color: '#ffffff' });
    },
    [P('Corazón', '#d9364f')],
  ),
  asset(
    'monedas',
    'Monedas',
    'objetos',
    ['dinero', 'ahorro', 'comprar'],
    0.2,
    (s) => {
      for (let i = 0; i < 4; i++) {
        const y = 165 - i * 22;
        s.fillEllipse(80, y + 10, 50, 14, '#d39a2a', 'secondary');
        s.fillRect(30, y, 100, 10, '#d39a2a', 'secondary');
        s.arc(80, y + 10, 50, 14, 0, Math.PI, { size: 3 });
        s.line(
          [
            [30, y],
            [30, y + 10],
          ],
          { size: 3 },
        );
        s.line(
          [
            [130, y],
            [130, y + 10],
          ],
          { size: 3 },
        );
        s.fillEllipse(80, y, 50, 14, '#f2c14e', 'primary');
        s.ellipse(80, y, 50, 14, { size: 3 });
      }
      s.fillEllipse(150, 120, 38, 38, '#f2c14e', 'primary');
      s.ellipse(150, 120, 38, 38, { size: 4 });
      s.ellipse(150, 120, 26, 26, { size: 2.5, color: '#b8862a' });
    },
    [P('Cara', '#f2c14e'), S('Canto', '#d39a2a')],
  ),
  asset(
    'mochila',
    'Mochila',
    'objetos',
    ['escuela', 'viaje', 'excursión'],
    0.25,
    (s) => {
      const body = roundRect(45, 40, 110, 150, 30);
      s.fillPoly(body, '#3f8f4f', 'primary');
      s.fillPoly(roundRect(65, 120, 70, 55, 12), '#2f7a46', 'primary');
      s.outline(body, { size: 4.5 });
      s.outline(roundRect(65, 120, 70, 55, 12), { size: 3.5 });
      s.arc(100, 40, 26, 24, Math.PI, Math.PI * 2, { size: 5 });
      s.line(
        [
          [70, 135],
          [130, 135],
        ],
        { size: 2.5 },
      );
    },
    [P('Tela', '#3f8f4f')],
  ),
  asset(
    'pizarra',
    'Pizarra',
    'objetos',
    ['clase', 'explicar', 'profesor'],
    0.4,
    (s) => {
      s.fillPoly(rect(10, 30, 180, 120), '#2f5d45', 'primary');
      s.outline(rect(10, 30, 180, 120), { size: 7, color: '#8a5a3b' });
      s.line(
        [
          [30, 60],
          [110, 60],
        ],
        { size: 3, color: '#ffffff' },
      );
      s.line(
        [
          [30, 85],
          [150, 85],
        ],
        { size: 3, color: '#ffffff' },
      );
      s.line(
        [
          [30, 110],
          [90, 110],
        ],
        { size: 3, color: '#ffffff' },
      );
      s.line(
        [
          [60, 150],
          [45, 195],
        ],
        { size: 5, color: '#8a5a3b' },
      );
      s.line(
        [
          [140, 150],
          [155, 195],
        ],
        { size: 5, color: '#8a5a3b' },
      );
    },
    [P('Pizarra', '#2f5d45')],
  ),
  asset(
    'mesa',
    'Mesa',
    'objetos',
    ['casa', 'comer', 'trabajar'],
    0.3,
    (s) => {
      s.fillPoly(rect(10, 80, 180, 18), '#b07a4f', 'primary');
      s.outline(rect(10, 80, 180, 18), { size: 4 });
      s.line(
        [
          [30, 98],
          [30, 190],
        ],
        { size: 7, color: '#8a5a3b' },
      );
      s.line(
        [
          [170, 98],
          [170, 190],
        ],
        { size: 7, color: '#8a5a3b' },
      );
    },
    [P('Madera', '#b07a4f')],
  ),
];

const VEHICLES: LibraryAsset[] = [
  asset(
    'coche',
    'Coche',
    'vehiculos',
    ['viaje', 'conducir', 'ciudad'],
    0.28,
    (s) => {
      const body: Pt[] = [
        [10, 140],
        [10, 105],
        [45, 100],
        [70, 60],
        [140, 60],
        [165, 100],
        [195, 108],
        [195, 140],
      ];
      s.fillPoly(body, '#c23b4e', 'primary');
      s.fillPoly(
        [
          [78, 70],
          [100, 70],
          [100, 98],
          [58, 98],
        ],
        '#bfe1f2',
      );
      s.fillPoly(
        [
          [110, 70],
          [134, 70],
          [152, 98],
          [110, 98],
        ],
        '#bfe1f2',
      );
      s.outline(body, { size: 4.5 });
      for (const x of [55, 155]) {
        s.fillEllipse(x, 142, 22, 22, INK);
        s.fillEllipse(x, 142, 9, 9, '#c8c8c8');
      }
      s.fillEllipse(188, 118, 6, 5, '#f6c945');
    },
    [P('Carrocería', '#c23b4e')],
  ),
  asset(
    'bicicleta',
    'Bicicleta',
    'vehiculos',
    ['deporte', 'paseo', 'ciudad'],
    0.28,
    (s) => {
      s.ellipse(50, 140, 38, 38, { size: 4.5 });
      s.ellipse(160, 140, 38, 38, { size: 4.5 });
      s.line(
        [
          [50, 140],
          [90, 140],
          [130, 85],
          [75, 85],
          [50, 140],
        ],
        { size: 5, color: '#2f6fd6', slot: 'primary' },
      );
      s.line(
        [
          [90, 140],
          [75, 85],
        ],
        { size: 5, color: '#2f6fd6', slot: 'primary' },
      );
      s.line(
        [
          [130, 85],
          [160, 140],
        ],
        { size: 5, color: '#2f6fd6', slot: 'primary' },
      );
      s.line(
        [
          [125, 70],
          [145, 65],
        ],
        { size: 5 },
      );
      s.line(
        [
          [130, 85],
          [128, 68],
        ],
        { size: 4 },
      );
      s.line(
        [
          [62, 72],
          [88, 72],
        ],
        { size: 7 },
      );
      s.line(
        [
          [75, 85],
          [72, 74],
        ],
        { size: 4 },
      );
    },
    [P('Cuadro', '#2f6fd6')],
  ),
  asset(
    'avion',
    'Avión',
    'vehiculos',
    ['viaje', 'vacaciones', 'volar'],
    0.3,
    (s) => {
      const wings: Pt[][] = [
        [
          [90, 95],
          [60, 30],
          [80, 30],
          [130, 95],
        ],
        [
          [90, 115],
          [60, 175],
          [80, 175],
          [130, 115],
        ],
      ];
      for (const w of wings) {
        s.fillPoly(w, '#c8d1da', 'secondary');
        s.outline(w, { size: 3.5 });
      }
      const tail: Pt[] = [
        [22, 100],
        [10, 62],
        [26, 62],
        [44, 100],
      ];
      s.fillPoly(tail, '#c23b4e', 'primary');
      s.outline(tail, { size: 3.5 });
      const body = ellipsePoints(105, 105, 92, 20, 30);
      s.fillPoly(body, '#ffffff', undefined, true);
      s.outline(body, { size: 4 });
      for (let i = 0; i < 5; i++) s.fillEllipse(120 + i * 14, 100, 4, 4, '#2f6fd6');
    },
    [P('Cola', '#c23b4e'), S('Alas', '#c8d1da')],
  ),
  asset(
    'autobus',
    'Autobús',
    'vehiculos',
    ['transporte', 'escuela', 'ciudad'],
    0.3,
    (s) => {
      const body = roundRect(5, 50, 190, 95, 14);
      s.fillPoly(body, '#f2b632', 'primary');
      for (let i = 0; i < 4; i++) s.fillPoly(rect(18 + i * 34, 62, 26, 28), '#bfe1f2');
      s.fillPoly(rect(158, 62, 28, 60), '#bfe1f2');
      s.outline(body, { size: 4.5 });
      s.line(
        [
          [5, 108],
          [150, 108],
        ],
        { size: 3 },
      );
      for (const x of [45, 150]) {
        s.fillEllipse(x, 146, 20, 20, INK);
        s.fillEllipse(x, 146, 8, 8, '#c8c8c8');
      }
    },
    [P('Carrocería', '#f2b632')],
  ),
];

const SYMBOLS: LibraryAsset[] = [
  asset(
    'bocadillo',
    'Bocadillo de diálogo',
    'simbolos',
    ['hablar', 'decir', 'conversación'],
    0.25,
    (s) => {
      const bubble = roundRect(10, 20, 180, 110, 40);
      const tail: Pt[] = [
        [58, 122],
        [42, 178],
        [98, 124],
      ];
      s.fillPoly(bubble, '#ffffff', 'primary');
      s.outline(bubble, { size: 4.5 });
      s.fillPoly(tail, '#ffffff', 'primary');
      s.line(
        [
          [60, 128],
          [42, 178],
          [96, 129],
        ],
        { size: 4.5 },
      );
    },
    [P('Fondo', '#ffffff')],
  ),
  asset(
    'pensamiento',
    'Bocadillo de pensamiento',
    'simbolos',
    ['pensar', 'soñar', 'idea'],
    0.25,
    (s) => {
      const c = blob(110, 75, 80, 50, 6, 0.18, 0.2);
      s.fillPoly(c, '#ffffff', 'primary', true);
      s.outline(c, { size: 4 });
      s.fillEllipse(48, 150, 14, 12, '#ffffff', 'primary');
      s.ellipse(48, 150, 14, 12, { size: 3.5 });
      s.fillEllipse(25, 180, 8, 7, '#ffffff', 'primary');
      s.ellipse(25, 180, 8, 7, { size: 3 });
    },
    [P('Fondo', '#ffffff')],
  ),
  asset(
    'interrogacion',
    'Interrogación',
    'simbolos',
    ['duda', 'pregunta', 'no sé'],
    0.2,
    (s) => {
      s.curve(
        (u) => {
          if (u < 0.6) {
            const a = Math.PI * 1.05 + (u / 0.6) * Math.PI * 1.45;
            return [100 + 45 * Math.cos(a), 65 + 40 * Math.sin(a)];
          }
          const k = (u - 0.6) / 0.4;
          return [100 + 45 * Math.cos(Math.PI * 2.5) * (1 - k), 105 + 35 * k];
        },
        { size: 14, color: '#2f6fd6', slot: 'primary' },
      );
      s.fillEllipse(100, 165, 10, 10, '#2f6fd6', 'primary');
    },
    [P('Color', '#2f6fd6')],
  ),
  asset(
    'exclamacion',
    'Exclamación',
    'simbolos',
    ['sorpresa', 'atención', 'importante'],
    0.2,
    (s) => {
      s.line(
        [
          [100, 20],
          [100, 140],
        ],
        { size: 18, color: '#c23b4e', slot: 'primary' },
      );
      s.fillEllipse(100, 175, 11, 11, '#c23b4e', 'primary');
    },
    [P('Color', '#c23b4e')],
  ),
  asset(
    'correcto',
    'Correcto',
    'simbolos',
    ['sí', 'bien', 'hecho'],
    0.18,
    (s) => {
      s.fillEllipse(100, 100, 85, 85, '#3f8f4f', 'primary');
      s.ellipse(100, 100, 85, 85, { size: 4.5 });
      s.line(
        [
          [60, 102],
          [88, 132],
          [142, 70],
        ],
        { size: 14, color: '#ffffff', wobble: 0.3 },
      );
    },
    [P('Fondo', '#3f8f4f')],
  ),
  asset(
    'incorrecto',
    'Incorrecto',
    'simbolos',
    ['no', 'mal', 'error'],
    0.18,
    (s) => {
      s.fillEllipse(100, 100, 85, 85, '#c23b4e', 'primary');
      s.ellipse(100, 100, 85, 85, { size: 4.5 });
      s.line(
        [
          [68, 68],
          [132, 132],
        ],
        { size: 14, color: '#ffffff', wobble: 0.3 },
      );
      s.line(
        [
          [132, 68],
          [68, 132],
        ],
        { size: 14, color: '#ffffff', wobble: 0.3 },
      );
    },
    [P('Fondo', '#c23b4e')],
  ),
  asset(
    'flecha-curva',
    'Flecha curva',
    'simbolos',
    ['señalar', 'dirección', 'mirar'],
    0.2,
    (s) => {
      s.quad([20, 160], [60, 30], [170, 60], { size: 7, color: '#d9622b', slot: 'primary' });
      s.line(
        [
          [140, 35],
          [172, 60],
          [138, 82],
        ],
        { size: 7, color: '#d9622b', slot: 'primary' },
      );
    },
    [P('Color', '#d9622b')],
  ),
];

const CHARACTERS: LibraryAsset[] = CHARACTER_PRESETS.map((p) => ({
  id: `personaje-${p.id}`,
  name: p.name,
  category: 'personajes' as const,
  tags: ['persona', 'personaje', p.options.expression, p.options.pose],
  size: 0.55,
  build: () => ({ ...buildCharacter(p.options), name: p.name }),
}));

export const LIBRARY: LibraryAsset[] = [...CHARACTERS, ...BUILDINGS, ...NATURE, ...OBJECTS, ...VEHICLES, ...SYMBOLS];

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchLibrary(query: string, category: CategoryId | 'todo' = 'todo'): LibraryAsset[] {
  const q = normalize(query.trim());
  return LIBRARY.filter(
    (a) =>
      (category === 'todo' || a.category === category) &&
      (!q || normalize(a.name).includes(q) || a.tags.some((t) => normalize(t).includes(q))),
  );
}

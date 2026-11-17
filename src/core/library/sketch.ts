// Utilidades para dibujar recursos originales por código con aspecto de dibujo a mano.
// Los contornos son trazos (se podrán animar trazo a trazo) y los rellenos, formas.
import { createShape, createStroke } from '../model/factory';
import type { ColorSlot, Group, Item, Shape } from '../model/types';
import { makeGroup } from '../edit/group';

export const INK = '#1d1d1f';

export type Pt = readonly [number, number];

export interface PenOptions {
  color?: string;
  size?: number;
  slot?: string;
  /** Amplitud del temblor de la mano en unidades del dibujo. */
  wobble?: number;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Remuestrea una polilínea cada `step` unidades. */
function resample(points: Pt[], step: number): Pt[] {
  if (points.length < 2) return points;
  const out: Pt[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

export class Sketch {
  readonly items: Item[] = [];
  private rand: () => number;
  private t = 0;

  constructor(seed: string) {
    this.rand = mulberry32(hashString(seed));
  }

  private push<T extends Item>(item: T, slot?: string): T {
    if (slot) item.slot = slot;
    this.items.push(item);
    return item;
  }

  /** Trazo a mano por una polilínea. */
  line(points: Pt[], opts: PenOptions = {}): this {
    const size = opts.size ?? 5;
    const wobble = opts.wobble ?? 0.6;
    const pts = resample(points, 3);
    const packed: number[] = [];
    const phase = this.rand() * Math.PI * 2;
    pts.forEach(([x, y], i) => {
      const u = pts.length > 1 ? i / (pts.length - 1) : 0;
      const n = Math.sin(u * Math.PI * 3 + phase) * wobble + (this.rand() - 0.5) * wobble * 0.6;
      const pressure = 0.5 + 0.35 * Math.sin(Math.PI * u) + (this.rand() - 0.5) * 0.05;
      packed.push(x + n, y + n * 0.7, Math.min(1, Math.max(0.1, pressure)), (this.t += 8));
    });
    this.push(createStroke(packed, { color: opts.color ?? INK, size, opacity: 1, thinning: 0.35 }), opts.slot);
    return this;
  }

  /** Curva paramétrica `fn(u)` con u en [0, 1]. */
  curve(fn: (u: number) => Pt, opts: PenOptions = {}, samples = 40): this {
    return this.line(
      Array.from({ length: samples + 1 }, (_, i) => fn(i / samples)),
      opts,
    );
  }

  /** Bézier cuadrática a mano. */
  quad(a: Pt, c: Pt, b: Pt, opts: PenOptions = {}): this {
    return this.curve((u) => {
      const v = 1 - u;
      return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]];
    }, opts);
  }

  /** Elipse a mano, que se solapa un poco al cerrar como cuando se dibuja de verdad. */
  ellipse(cx: number, cy: number, rx: number, ry: number, opts: PenOptions = {}, overshoot = 0.06): this {
    const start = -Math.PI / 2 + (this.rand() - 0.5) * 0.6;
    return this.curve(
      (u) => {
        const a = start + u * Math.PI * 2 * (1 + overshoot);
        return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
      },
      opts,
      Math.max(24, Math.round((rx + ry) / 2)),
    );
  }

  /** Arco entre dos ángulos (radianes). */
  arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, opts: PenOptions = {}): this {
    return this.curve(
      (u) => [cx + rx * Math.cos(from + (to - from) * u), cy + ry * Math.sin(from + (to - from) * u)],
      opts,
    );
  }

  /** Polígono a mano (contorno cerrado). */
  outline(points: Pt[], opts: PenOptions = {}): this {
    return this.line([...points, points[0]!], opts);
  }

  private fillShape(shape: Shape, color: string, slot?: string): this {
    this.push(shape, slot);
    return this;
  }

  fillRect(x: number, y: number, w: number, h: number, color: string, slot?: string): this {
    return this.fillShape(
      createShape('rect', x, y, w, h, { stroke: null, strokeWidth: 0, fill: color, opacity: 1 }),
      color,
      slot,
    );
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, color: string, slot?: string): this {
    return this.fillShape(
      createShape('ellipse', cx - rx, cy - ry, rx * 2, ry * 2, {
        stroke: null,
        strokeWidth: 0,
        fill: color,
        opacity: 1,
      }),
      color,
      slot,
    );
  }

  /** Polígono relleno; `smooth` lo redondea (pelo, nubes, copas de árbol). */
  fillPoly(points: Pt[], color: string, slot?: string, smooth = false): this {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const shape = createShape('polygon', x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0, {
      stroke: null,
      strokeWidth: 0,
      fill: color,
      opacity: 1,
    });
    shape.points = points.flatMap(([x, y]) => [x - x0, y - y0]);
    if (smooth) shape.smooth = true;
    return this.fillShape(shape, color, slot);
  }

  /** Agrupa todo lo dibujado como recurso de biblioteca. */
  toGroup(source: Group['source'], name: string, slots?: ColorSlot[]): Group {
    return makeGroup(this.items, { name, source, ...(slots?.length ? { slots } : {}) });
  }
}

/** Puntos de una elipse (para rellenos). */
export function ellipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 24,
  from = 0,
  to = Math.PI * 2,
): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = from + ((to - from) * i) / (to - from >= Math.PI * 2 - 1e-9 ? n : n - 1);
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt;
  });
}

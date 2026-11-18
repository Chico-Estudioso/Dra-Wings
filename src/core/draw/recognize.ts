// Formas rápidas: reconoce un trazo hecho a mano como línea, círculo, elipse, rectángulo, triángulo
// o polígono y devuelve su versión limpia como puntos (se sigue dibujando con el mismo pincel).
import type { Point } from '../geometry/matrix';

export type ShapeKind = 'line' | 'circle' | 'ellipse' | 'rectangle' | 'triangle' | 'polygon';

export interface Recognized {
  kind: ShapeKind;
  /** Puntos de la forma limpia (cerrada si `closed`: el último repite el primero). */
  points: Point[];
  closed: boolean;
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  line: 'Línea',
  circle: 'Círculo',
  ellipse: 'Elipse',
  rectangle: 'Rectángulo',
  triangle: 'Triángulo',
  polygon: 'Polígono',
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1]!, pts[i]!);
  return len;
}

/** `n` puntos repartidos por igual a lo largo del recorrido (no depende de la velocidad al dibujar). */
function resample(pts: Point[], n: number): Point[] {
  const total = pathLength(pts);
  if (total === 0) return [pts[0]!];
  const step = total / (n - 1);
  const out: Point[] = [pts[0]!];
  let acc = 0;
  let next = step;
  for (let i = 1; i < pts.length && out.length < n; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = dist(a, b);
    while (d > 0 && acc + d >= next && out.length < n) {
      const k = (next - acc) / d;
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      next += step;
    }
    acc += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1]!);
  return out;
}

function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const u = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
}

/** Ramer–Douglas–Peucker sobre `pts[from..to]`: índices de los vértices conservados (sin `to`). */
function rdp(pts: Point[], from: number, to: number, tol: number, out: number[]): void {
  let worst = -1;
  let max = tol;
  for (let i = from + 1; i < to; i++) {
    const d = segDist(pts[i]!, pts[from]!, pts[to]!);
    if (d > max) {
      max = d;
      worst = i;
    }
  }
  if (worst < 0) {
    out.push(from);
    return;
  }
  rdp(pts, from, worst, tol, out);
  rdp(pts, worst, to, tol, out);
}

/** Puntos a lo largo de una polilínea, cada `step` como mucho (para que el pincel no redondee las esquinas). */
function densify(vertices: Point[], step: number): Point[] {
  const out: Point[] = [vertices[0]!];
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1]!;
    const b = vertices[i]!;
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

const snapAngle = (deg: number, to: number[], tol: number) => {
  for (const t of to) if (Math.abs(deg - t) <= tol) return t;
  return deg;
};

function recognizeLine(pts: Point[], diag: number): Recognized | null {
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const chord = dist(a, b);
  if (chord < diag * 0.9) return null;
  const maxDev = Math.max(...pts.map((p) => segDist(p, a, b)));
  if (pathLength(pts) / chord > 1.15 || maxDev / chord > 0.07) return null;
  // Casi horizontal, vertical o a 45°: exacta.
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const snapped = (snapAngle(deg, [-180, -135, -90, -45, 0, 45, 90, 135, 180], 4) * Math.PI) / 180;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const h = chord / 2;
  const p0 = { x: mid.x - Math.cos(snapped) * h, y: mid.y - Math.sin(snapped) * h };
  const p1 = { x: mid.x + Math.cos(snapped) * h, y: mid.y + Math.sin(snapped) * h };
  return { kind: 'line', points: densify([p0, p1], Math.max(2, chord / 40)), closed: false };
}

interface EllipseFit {
  cx: number;
  cy: number;
  a: number;
  b: number;
  theta: number;
  error: number;
}

function fitEllipse(pts: Point[]): EllipseFit {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  let theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  // Ejes casi horizontales o verticales: exactos.
  const deg = snapAngle((theta * 180) / Math.PI, [-90, 0, 90], 8);
  theta = (deg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const local = pts.map((p) => ({ u: (p.x - mx) * cos + (p.y - my) * sin, v: -(p.x - mx) * sin + (p.y - my) * cos }));
  const u0 = Math.min(...local.map((q) => q.u));
  const u1 = Math.max(...local.map((q) => q.u));
  const v0 = Math.min(...local.map((q) => q.v));
  const v1 = Math.max(...local.map((q) => q.v));
  const a = (u1 - u0) / 2;
  const b = (v1 - v0) / 2;
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  const error =
    local.reduce((s, q) => s + Math.abs(Math.hypot((q.u - cu) / (a || 1), (q.v - cv) / (b || 1)) - 1), 0) / n;
  return { cx: mx + cu * cos - cv * sin, cy: my + cu * sin + cv * cos, a, b, theta, error };
}

function ellipsePoints(e: EllipseFit, circle: boolean, step: number): Point[] {
  const r = (e.a + e.b) / 2;
  const a = circle ? r : e.a;
  const b = circle ? r : e.b;
  const n = Math.max(24, Math.ceil((2 * Math.PI * Math.max(a, b)) / step));
  const cos = Math.cos(e.theta);
  const sin = Math.sin(e.theta);
  // Empieza arriba (como se suele dibujar un círculo) y cierra repitiendo el primer punto.
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const u = a * Math.cos(t);
    const v = b * Math.sin(t);
    return { x: e.cx + u * cos - v * sin, y: e.cy + u * sin + v * cos };
  });
}

/** Vértices de un recorrido cerrado (empezando por el punto más alejado del centro). */
function closedVertices(pts: Point[], tol: number): Point[] {
  const ring = pts.slice(0, -1);
  const c = { x: ring.reduce((s, p) => s + p.x, 0) / ring.length, y: ring.reduce((s, p) => s + p.y, 0) / ring.length };
  let start = 0;
  ring.forEach((p, i) => dist(p, c) > dist(ring[start]!, c) && (start = i));
  const rot = [...ring.slice(start), ...ring.slice(0, start), ring[start]!];
  let far = 0;
  rot.forEach((p, i) => dist(p, rot[0]!) > dist(rot[far]!, rot[0]!) && (far = i));
  const idx: number[] = [];
  rdp(rot, 0, far, tol, idx);
  rdp(rot, far, rot.length - 1, tol, idx);
  return idx.map((i) => rot[i]!);
}

function polygonError(pts: Point[], vertices: Point[]): number {
  const loop = [...vertices, vertices[0]!];
  return (
    pts.reduce((s, p) => {
      let best = Infinity;
      for (let i = 1; i < loop.length; i++) best = Math.min(best, segDist(p, loop[i - 1]!, loop[i]!));
      return s + best;
    }, 0) / pts.length
  );
}

function interiorAngles(v: Point[]): number[] {
  return v.map((p, i) => {
    const a = v[(i + v.length - 1) % v.length]!;
    const b = v[(i + 1) % v.length]!;
    const d = Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x);
    const deg = Math.abs((d * 180) / Math.PI) % 360;
    return deg > 180 ? 360 - deg : deg;
  });
}

/** Rectángulo exacto a partir de un cuadrilátero casi recto (con giro; recto si casi lo es). */
function exactRectangle(v: Point[]): Point[] {
  // Media de las direcciones de los lados módulo 90° (ángulo multiplicado por 4).
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < 4; i++) {
    const a = v[i]!;
    const b = v[(i + 1) % 4]!;
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 4;
    const w = dist(a, b);
    sx += Math.cos(ang) * w;
    sy += Math.sin(ang) * w;
  }
  let theta = Math.atan2(sy, sx) / 4;
  if (Math.abs((theta * 180) / Math.PI) < 7) theta = 0;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const local = v.map((p) => ({ u: p.x * cos + p.y * sin, w: -p.x * sin + p.y * cos }));
  const u0 = Math.min(...local.map((q) => q.u));
  const u1 = Math.max(...local.map((q) => q.u));
  const w0 = Math.min(...local.map((q) => q.w));
  const w1 = Math.max(...local.map((q) => q.w));
  return [
    [u0, w0],
    [u1, w0],
    [u1, w1],
    [u0, w1],
  ].map(([u, w]) => ({ x: u! * cos - w! * sin, y: u! * sin + w! * cos }));
}

/**
 * Reconoce la forma de un trazo a mano alzada. Null si no se parece lo bastante a ninguna (entonces
 * se deja el trazo tal cual).
 */
export function recognizeShape(raw: Point[]): Recognized | null {
  if (raw.length < 4) return null;
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const total = pathLength(raw);
  if (diag === 0 || total === 0) return null;
  const pts = resample(raw, 96);
  const step = Math.max(2, diag / 40);
  const gap = dist(raw[0]!, raw[raw.length - 1]!);
  const closed = gap < diag * 0.25 && total > diag * 1.8;
  if (!closed) return recognizeLine(pts, diag);

  const ring = [...pts, pts[0]!];
  const e = fitEllipse(pts);
  const vertices = closedVertices(ring, diag * 0.07);
  // Errores medios en unidades de la escena, comparables entre sí.
  const polyErr = vertices.length >= 3 ? polygonError(pts, vertices) : Infinity;
  const ellErr = e.error * ((e.a + e.b) / 2);
  const rightAngles = vertices.length === 4 && interiorAngles(vertices).every((a) => Math.abs(a - 90) < 18);
  // Pocos lados: basta con que el polígono encaje mejor; más lados: mucho mejor (si no, es una curva).
  const polygonWins =
    polyErr < diag * 0.035 &&
    ((vertices.length <= 4 && polyErr < ellErr * 0.6) || (vertices.length <= 8 && polyErr < ellErr * 0.4));

  if (polygonWins) {
    if (vertices.length === 3)
      return { kind: 'triangle', points: densify([...vertices, vertices[0]!], step), closed: true };
    if (rightAngles) {
      const r = exactRectangle(vertices);
      return { kind: 'rectangle', points: densify([...r, r[0]!], step), closed: true };
    }
    return { kind: 'polygon', points: densify([...vertices, vertices[0]!], step), closed: true };
  }
  if (e.error < 0.08) {
    const circle = Math.min(e.a, e.b) / Math.max(e.a, e.b) > 0.85;
    return { kind: circle ? 'circle' : 'ellipse', points: ellipsePoints(e, circle, step), closed: true };
  }
  return null;
}

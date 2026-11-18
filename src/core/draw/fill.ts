// Bote de pintura: rellena la zona del dibujo donde se hace clic.
//
// 1. Sobre una imagen del dibujo (RGBA), la zona son los píxeles conectados de color parecido al del
//    clic: las líneas de otro color son paredes.
// 2. Huecos: si la zona se escapa hasta el borde de la imagen, se repite «cerrando» los huecos
//    pequeños (erosión con radio creciente, que tapa los pasos más estrechos que 2·r). Si aun así llega
//    al borde, es una zona que de verdad acaba en el borde de la hoja (el cielo, el fondo) y vale tal
//    cual. Después se recupera lo erosionado sin cruzar paredes y se mete 1 px bajo las líneas para que
//    no quede una rendija clara entre el relleno y la línea.
// 3. El contorno se vectoriza (contorno exterior y agujeros) y se simplifica.
//
// Puro y sin DOM: quien llama dibuja la imagen y crea la forma.

export interface Raster {
  width: number;
  height: number;
  /** RGBA, 4 bytes por píxel. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface FillOptions {
  /** Diferencia máxima por canal (0–255) para considerar un píxel del mismo color. */
  tolerance: number;
  /** Radios (en píxeles de la imagen) con los que se prueba a cerrar huecos, de menor a mayor. */
  gaps: readonly number[];
  /** Zonas más pequeñas que esto (píxeles) no se rellenan: el clic cayó sobre una línea. */
  minArea: number;
}

export const DEFAULT_FILL: FillOptions = { tolerance: 40, gaps: [0, 3, 6, 10], minArea: 12 };

export interface FillRegion {
  /** 1 = relleno. */
  mask: Uint8Array;
  /** Radio de cierre de huecos que hizo falta (0: la zona ya estaba cerrada). */
  gap: number;
  area: number;
}

/** Píxeles de color parecido al de `seed` (índice de píxel). */
export function similarMask(img: Raster, seed: number, tolerance: number): Uint8Array {
  const { data } = img;
  const n = img.width * img.height;
  const out = new Uint8Array(n);
  const r = data[seed * 4]!;
  const g = data[seed * 4 + 1]!;
  const b = data[seed * 4 + 2]!;
  const a = data[seed * 4 + 3]!;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    if (
      Math.abs(data[j]! - r) <= tolerance &&
      Math.abs(data[j + 1]! - g) <= tolerance &&
      Math.abs(data[j + 2]! - b) <= tolerance &&
      Math.abs(data[j + 3]! - a) <= tolerance
    )
      out[i] = 1;
  }
  return out;
}

/**
 * Distancia (aprox. euclídea, chaflán 1/√2) de cada píxel al píxel más cercano con `mask` = 0. El
 * borde de la imagen no cuenta como pared.
 */
export function distanceToZero(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const D = Math.SQRT2;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i]!;
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1]! + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w]! + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1]! + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1]! + D);
      }
      d[i] = v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i]!;
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, d[i + 1]! + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w]! + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1]! + D);
        if (x > 0) v = Math.min(v, d[i + w - 1]! + D);
      }
      d[i] = v;
    }
  return d;
}

/** Relleno 4-conexo desde `seed` sobre los píxeles con `allowed` = 1. */
function flood(allowed: Uint8Array, w: number, h: number, seed: number) {
  const region = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  let count = 0;
  let touches = false;
  region[seed] = 1;
  stack[top++] = seed;
  while (top > 0) {
    const i = stack[--top]!;
    count++;
    const x = i % w;
    if (x === 0 || x === w - 1 || i < w || i >= w * (h - 1)) touches = true;
    if (x > 0 && !region[i - 1] && allowed[i - 1]) {
      region[i - 1] = 1;
      stack[top++] = i - 1;
    }
    if (x < w - 1 && !region[i + 1] && allowed[i + 1]) {
      region[i + 1] = 1;
      stack[top++] = i + 1;
    }
    if (i >= w && !region[i - w] && allowed[i - w]) {
      region[i - w] = 1;
      stack[top++] = i - w;
    }
    if (i < w * (h - 1) && !region[i + w] && allowed[i + w]) {
      region[i + w] = 1;
      stack[top++] = i + w;
    }
  }
  return { region, count, touches };
}

/** Crece la zona hasta `steps` píxeles (8-conexos) por dentro de `through`, sin cruzar paredes. */
function grow(region: Uint8Array, through: Uint8Array | null, w: number, h: number, steps: number): void {
  // Frente inicial: solo los píxeles del borde de la zona.
  let front: Int32Array = new Int32Array(1024);
  let n = 0;
  const add = (buf: Int32Array, len: number, v: number): Int32Array => {
    if (len >= buf.length) {
      const bigger = new Int32Array(buf.length * 2);
      bigger.set(buf);
      buf = bigger;
    }
    buf[len] = v;
    return buf;
  };
  for (let i = 0; i < region.length; i++) {
    if (!region[i]) continue;
    const x = i % w;
    const edge =
      (x > 0 && !region[i - 1]) ||
      (x < w - 1 && !region[i + 1]) ||
      (i >= w && !region[i - w]) ||
      (i < w * (h - 1) && !region[i + w]);
    if (edge) front = add(front, n++, i);
  }
  for (let s = 0; s < steps && n > 0; s++) {
    let next: Int32Array = new Int32Array(Math.max(1024, n * 2));
    let m = 0;
    for (let k = 0; k < n; k++) {
      const i = front[k]!;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const j = ny * w + nx;
          if (region[j] || (through && !through[j])) continue;
          region[j] = 1;
          next = add(next, m++, j);
        }
      }
    }
    front = next;
    n = m;
  }
}

/** Zona que se rellena al hacer clic en (x, y) de la imagen, o null si no hay nada que rellenar. */
export function fillRegion(img: Raster, x: number, y: number, opts: FillOptions = DEFAULT_FILL): FillRegion | null {
  const { width: w, height: h } = img;
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const seed = sy * w + sx;
  const fillable = similarMask(img, seed, opts.tolerance);
  const dist = opts.gaps.some((r) => r > 0) ? distanceToZero(fillable, w, h) : null;
  let best: { region: Uint8Array; count: number; gap: number } | null = null;
  for (const r of opts.gaps) {
    // En un paso más estrecho que el radio, cerrar huecos más grandes ya no puede funcionar.
    if (r > 0 && dist![seed]! <= r) break;
    let allowed = fillable;
    if (r > 0) {
      allowed = new Uint8Array(w * h);
      for (let i = 0; i < allowed.length; i++) allowed[i] = dist![i]! > r ? 1 : 0;
    }
    const f = flood(allowed, w, h, seed);
    if (!best || !f.touches) best = { region: f.region, count: f.count, gap: r };
    if (!f.touches) break;
  }
  if (!best || best.count < opts.minArea) return null;
  const { region, gap } = best;
  if (gap > 0) grow(region, fillable, w, h, gap); // recupera esquinas y bordes erosionados
  grow(region, null, w, h, 1); // un poco por debajo de las líneas
  let area = 0;
  for (let i = 0; i < region.length; i++) area += region[i]!;
  return { mask: region, gap, area };
}

// Vectorizado

const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const DY = [0, -1, -1, -1, 0, 1, 1, 1];

/** Dirección (índice de DX/DY) del vecino (dx, dy). */
function dirOf(dx: number, dy: number): number {
  for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d;
  return 0;
}

/**
 * Contorno (centros de píxel, en orden) de la pieza 8-conexa que contiene (sx, sy), que debe ser su
 * primer píxel en orden de lectura. Seguimiento de Moore con el criterio de parada de Jacob.
 */
function traceFrom(inside: (x: number, y: number) => boolean, sx: number, sy: number, limit: number): number[] {
  const out = [sx + 0.5, sy + 0.5];
  let cx = sx;
  let cy = sy;
  let back = 0; // se entra desde el oeste
  for (let n = 0; n < limit; n++) {
    let found = -1;
    for (let i = 1; i <= 8; i++) {
      const d = (back + i) % 8;
      if (inside(cx + DX[d]!, cy + DY[d]!)) {
        found = d;
        break;
      }
    }
    if (found < 0) return out; // píxel suelto
    const prev = (found + 7) % 8;
    const bx = cx + DX[prev]!;
    const by = cy + DY[prev]!;
    cx += DX[found]!;
    cy += DY[found]!;
    back = dirOf(bx - cx, by - cy);
    if (cx === sx && cy === sy && back === 0) break;
    out.push(cx + 0.5, cy + 0.5);
  }
  return out;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const len = vx * vx + vy * vy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len)) : 0;
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}

/** Douglas-Peucker sobre los puntos [from..to] (pares x, y), conservando los extremos. */
function rdp(pts: number[], from: number, to: number, eps: number, keep: Uint8Array): void {
  const stack: [number, number][] = [[from, to]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let far = eps;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(pts[i * 2]!, pts[i * 2 + 1]!, pts[a * 2]!, pts[a * 2 + 1]!, pts[b * 2]!, pts[b * 2 + 1]!);
      if (d > far) {
        far = d;
        worst = i;
      }
    }
    if (worst < 0) continue;
    keep[worst] = 1;
    stack.push([a, worst], [worst, b]);
  }
}

/** Simplifica un contorno cerrado (pares x, y) con tolerancia `eps`. */
export function simplifyRing(pts: number[], eps: number): number[] {
  const n = pts.length / 2;
  if (n <= 4) return pts.slice();
  // Se parte por el punto más lejano al primero: dos cadenas abiertas.
  let far = 0;
  let best = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(pts[i * 2]! - pts[0]!, pts[i * 2 + 1]! - pts[1]!);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const ring = [...pts, pts[0]!, pts[1]!];
  const keep = new Uint8Array(n + 1);
  keep[0] = keep[far] = keep[n] = 1;
  rdp(ring, 0, far, eps, keep);
  rdp(ring, far, n, eps, keep);
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2]!, pts[i * 2 + 1]!);
  return out;
}

export interface Contours {
  /** Contorno exterior (pares x, y en píxeles de la imagen). */
  outer: number[];
  /** Agujeros: zonas sin rellenar rodeadas por el relleno. */
  holes: number[][];
}

/**
 * Contorno exterior y agujeros de una zona (una sola pieza), simplificados para no pasar de
 * `maxPoints` vértices en total. Los agujeros de menos de `minHole` píxeles se rellenan.
 */
export function traceRegion(
  mask: Uint8Array,
  w: number,
  h: number,
  { minHole = 16, maxHoles = 64, maxPoints = 1800 } = {},
): Contours | null {
  let start = -1;
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) {
      start = i;
      break;
    }
  if (start < 0) return null;
  const limit = 4 * (w + h) + 8 * mask.length;
  const inRegion = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const outer = traceFrom(inRegion, start % w, Math.floor(start / w), limit);

  // Agujeros: lo no rellenado que no conecta (4-conexo) con el borde de la imagen.
  const label = new Int32Array(w * h); // 0 sin visitar, -1 exterior, k > 0 agujero k
  const stack = new Int32Array(w * h);
  const spread = (seed: number, value: number): number => {
    let top = 0;
    let count = 0;
    label[seed] = value;
    stack[top++] = seed;
    while (top > 0) {
      const i = stack[--top]!;
      count++;
      const x = i % w;
      const y = (i - x) / w;
      const visit = (j: number) => {
        if (!mask[j] && !label[j]) {
          label[j] = value;
          stack[top++] = j;
        }
      };
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (y > 0) visit(i - w);
      if (y < h - 1) visit(i + w);
    }
    return count;
  };
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (!mask[i] && !label[i]) spread(i, -1);
    }
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (!mask[i] && !label[i]) spread(i, -1);
    }
  const holes: { start: number; area: number; id: number }[] = [];
  let next = 1;
  for (let i = 0; i < mask.length; i++)
    if (!mask[i] && !label[i]) {
      const id = next++;
      holes.push({ start: i, area: spread(i, id), id });
    }
  const kept = holes
    .filter((hl) => hl.area >= minHole)
    .sort((a, b) => b.area - a.area)
    .slice(0, maxHoles);
  const holeRings = kept.map((hl) =>
    traceFrom(
      (x, y) => x >= 0 && y >= 0 && x < w && y < h && label[y * w + x] === hl.id,
      hl.start % w,
      Math.floor(hl.start / w),
      limit,
    ),
  );

  for (let eps = 0.75; ; eps *= 1.5) {
    const o = simplifyRing(outer, eps);
    const hs = holeRings.map((r) => simplifyRing(r, eps)).filter((r) => r.length >= 6);
    const total = (o.length + hs.reduce((s, r) => s + r.length, 0)) / 2;
    if (total <= maxPoints || eps > 64) return { outer: o, holes: hs };
  }
}

// Goma de borrar no destructiva: divide los trazos en los tramos que no toca y elimina formas o
// textos completos. Los trazos resultantes conservan estilo y transformación.
import { newId } from '../model/factory';
import type { Item, Stroke } from '../model/types';
import { distToSegment, hitItem, itemMatrix, POINT_STRIDE } from '../geometry/items';
import { apply, invert, meanScale, type Point } from '../geometry/matrix';

/** Inserta puntos interpolados para que ningún tramo supere `maxSeg`. */
export function densify(points: number[], maxSeg: number): number[] {
  if (points.length <= POINT_STRIDE) return points.slice();
  const out: number[] = [points[0]!, points[1]!, points[2]!, points[3]!];
  for (let i = POINT_STRIDE; i < points.length; i += POINT_STRIDE) {
    const ax = points[i - 4]!;
    const ay = points[i - 3]!;
    const bx = points[i]!;
    const by = points[i + 1]!;
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / maxSeg);
    for (let k = 1; k < n; k++) {
      const u = k / n;
      for (let c = 0; c < POINT_STRIDE; c++) out.push(points[i - 4 + c]! + (points[i + c]! - points[i - 4 + c]!) * u);
    }
    for (let c = 0; c < POINT_STRIDE; c++) out.push(points[i + c]!);
  }
  return out;
}

function nearPath(p: Point, path: Point[], r: number): boolean {
  if (path.length === 1) return Math.hypot(p.x - path[0]!.x, p.y - path[0]!.y) <= r;
  for (let i = 1; i < path.length; i++) if (distToSegment(p, path[i - 1]!, path[i]!) <= r) return true;
  return false;
}

/**
 * Aplica la goma (trayectoria `path` en coordenadas de escena, radio `radius`) a un trazo.
 * Devuelve `null` si no lo toca, o los trazos que quedan (posiblemente ninguno).
 */
export function eraseStroke(stroke: Stroke, path: Point[], radius: number): Stroke[] | null {
  const m = itemMatrix(stroke);
  const inv = invert(m);
  const localPath = path.map((p) => apply(inv, p));
  const r = radius / meanScale(m) + stroke.style.size / 2;
  const pts = densify(stroke.points, Math.max(0.5, r / 2));
  const keep: boolean[] = [];
  let removed = false;
  for (let i = 0; i < pts.length; i += POINT_STRIDE) {
    const hit = nearPath({ x: pts[i]!, y: pts[i + 1]! }, localPath, r);
    keep.push(!hit);
    if (hit) removed = true;
  }
  if (!removed) return null;
  const pieces: Stroke[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length >= 2 * POINT_STRIDE) pieces.push({ ...structuredClone(stroke), id: newId(), points: run });
    run = [];
  };
  keep.forEach((k, idx) => {
    if (k) for (let c = 0; c < POINT_STRIDE; c++) run.push(pts[idx * POINT_STRIDE + c]!);
    else flush();
  });
  flush();
  return pieces;
}

export interface EraseResult {
  /** id original → elementos que lo sustituyen (vacío = eliminado). */
  replacements: Map<string, Item[]>;
}

export function eraseItems(items: Item[], path: Point[], radius: number): EraseResult {
  const replacements = new Map<string, Item[]>();
  for (const item of items) {
    if (item.type === 'stroke') {
      const r = eraseStroke(item, path, radius);
      if (r) replacements.set(item.id, r);
    } else if (path.some((p) => hitItem(item, p, radius))) {
      replacements.set(item.id, []);
    }
  }
  return { replacements };
}

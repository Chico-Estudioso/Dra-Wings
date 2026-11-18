// Dibujo de una lista evaluada sobre Canvas 2D. Funciona con HTMLCanvasElement y OffscreenCanvas
// (previsualización y exportación usan este mismo código; ver ADR-002).
import type { FontId, Shape, TextItem } from '../model/types';
import { arrowHeadSize } from '../geometry/items';
import { shapePerimeterOf } from '../anim/perimeter';
import type { RenderItem } from './evaluate';
import { strokeOutline } from './stroke-outline';
import { jitterMatrix, seedOf, type Boil } from './boil';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const FONT_FAMILIES: Record<FontId, string> = {
  hand: '"Patrick Hand", sans-serif',
  script: '"Caveat", cursive',
  rounded: '"Nunito", sans-serif',
};

export function fontString(font: FontId, size: number): string {
  return `${size}px ${FONT_FAMILIES[font]}`;
}

/** Caché de geometría por objeto de elemento: Immer crea objetos nuevos al editar, así que se invalida sola. */
export class PathCache {
  private paths = new WeakMap<object, Path2D>();
  private variants = new WeakMap<object, Map<string, Path2D>>();
  get(key: object, build: () => Path2D): Path2D {
    let p = this.paths.get(key);
    if (!p) {
      p = build();
      this.paths.set(key, p);
    }
    return p;
  }
  /** Variantes de un mismo elemento (por ejemplo, las del trazo vivo). */
  getVariant(key: object, variant: string, build: () => Path2D): Path2D {
    let m = this.variants.get(key);
    if (!m) this.variants.set(key, (m = new Map()));
    let p = m.get(variant);
    if (!p) {
      p = build();
      m.set(variant, p);
    }
    return p;
  }
}

export function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length < 3) return path;
  path.moveTo(outline[0]![0]!, outline[0]![1]!);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i]!;
    const [x1, y1] = outline[(i + 1) % outline.length]!;
    path.quadraticCurveTo(x0!, y0!, (x0! + x1!) / 2, (y0! + y1!) / 2);
  }
  path.closePath();
  return path;
}

/** Polígono cerrado; con `smooth`, curvas por los puntos medios (contornos orgánicos). */
function polygonPath(ctx: Ctx2D, pts: number[], smooth: boolean) {
  const n = pts.length / 2;
  if (n < 2) return;
  if (!smooth || n < 3) {
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
    ctx.closePath();
    return;
  }
  const mid = (i: number) => {
    const a = (i % n) * 2;
    const b = ((i + 1) % n) * 2;
    return [(pts[a]! + pts[b]!) / 2, (pts[a + 1]! + pts[b + 1]!) / 2] as const;
  };
  const [sx, sy] = mid(n - 1);
  ctx.moveTo(sx, sy);
  for (let i = 0; i < n; i++) {
    const [mx, my] = mid(i);
    ctx.quadraticCurveTo(pts[i * 2]!, pts[i * 2 + 1]!, mx, my);
  }
  ctx.closePath();
}

function drawShape(ctx: Ctx2D, s: Shape, progress = 1, fillProgress = 1) {
  const { stroke, strokeWidth, fill } = s.style;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = strokeWidth;
  if (progress < 1) {
    // Contorno parcial con un guion que avanza; si aún no ha empezado, nada.
    if (progress <= 0) return;
    const len = shapePerimeterOf(s);
    ctx.setLineDash([len * progress, len + strokeWidth * 4]);
  }
  if (s.shape === 'line' || s.shape === 'arrow') {
    if (!stroke || strokeWidth <= 0) return;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s.w, s.h);
    ctx.stroke();
    if (s.shape === 'arrow' && progress >= 1 && (s.w !== 0 || s.h !== 0)) {
      const head = arrowHeadSize(strokeWidth);
      const ang = Math.atan2(s.h, s.w);
      ctx.fillStyle = stroke;
      ctx.beginPath();
      ctx.moveTo(s.w, s.h);
      ctx.lineTo(s.w - head * Math.cos(ang - Math.PI / 7), s.h - head * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(s.w - head * Math.cos(ang + Math.PI / 7), s.h - head * Math.sin(ang + Math.PI / 7));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  const x = Math.min(0, s.w);
  const y = Math.min(0, s.h);
  const w = Math.abs(s.w);
  const h = Math.abs(s.h);
  ctx.beginPath();
  if (s.shape === 'polygon') polygonPath(ctx, s.points ?? [], !!s.smooth);
  else if (s.shape === 'rect') ctx.rect(x, y, w, h);
  else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  if (fill && fillProgress > 0) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * fillProgress;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/** Dibuja un texto; con `progress` < 1 se escribe letra a letra. */
export function drawText(ctx: Ctx2D, t: TextItem, progress = 1) {
  ctx.font = fontString(t.font, t.size);
  ctx.fillStyle = t.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = t.align;
  const x = t.align === 'left' ? 0 : t.align === 'center' ? t.w / 2 : t.w;
  let remaining = progress >= 1 ? Infinity : Math.floor([...t.text.replace(/\n/g, '')].length * progress);
  t.text.split('\n').forEach((line, i) => {
    if (remaining <= 0) return;
    const chars = [...line];
    const visible = chars.length <= remaining ? line : chars.slice(0, remaining).join('');
    remaining -= chars.length;
    ctx.fillText(visible, x, i * t.size * t.lineHeight);
  });
}

/** Mide la caja de un texto con el contexto dado (las fuentes deben estar cargadas). */
export function measureText(ctx: Ctx2D, text: string, font: FontId, size: number, lineHeight: number) {
  ctx.save();
  ctx.font = fontString(font, size);
  const lines = text.split('\n');
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), size * 0.3);
  ctx.restore();
  return { w: Math.ceil(w), h: Math.ceil(lines.length * size * lineHeight) };
}

/** Imágenes decodificadas por id de medio (las prepara el editor o el exportador). */
export type ImageSources = ReadonlyMap<string, CanvasImageSource>;

function drawImageItem(ctx: Ctx2D, item: Extract<RenderItem['item'], { type: 'image' }>, images?: ImageSources) {
  const img = images?.get(item.assetId);
  if (img) {
    ctx.drawImage(img, 0, 0, item.w, item.h);
    return;
  }
  // Aún sin cargar (o ausente): marcador neutro del tamaño de la imagen.
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, 0, item.w, item.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(item.w, item.h) / 200;
  ctx.strokeRect(0, 0, item.w, item.h);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(item.w, item.h);
  ctx.moveTo(item.w, 0);
  ctx.lineTo(0, item.h);
  ctx.stroke();
}

/** Temblor de formas y textos: en proporción al grosor de su línea o al tamaño de la letra. */
function jitterFor(item: RenderItem['item'], boil: Boil) {
  if (item.type === 'shape') {
    const amp = Math.min(2.5, 0.6 + (item.style.strokeWidth || 4) * 0.12) * boil.amount;
    return jitterMatrix(seedOf(item.id), boil.variant, item.w, item.h, amp);
  }
  if (item.type === 'text') {
    const amp = Math.min(2, 0.4 + item.size * 0.02) * boil.amount;
    return jitterMatrix(seedOf(item.id), boil.variant, item.w, item.h, amp);
  }
  return null;
}

/**
 * Dibuja la lista sobre la transformación actual del contexto (la del lienzo o de la vista). Con
 * `boil`, cada trazo, forma y texto usa su variante del «trazo vivo» (las imágenes no tiemblan).
 */
export function drawRenderList(
  ctx: Ctx2D,
  list: RenderItem[],
  cache: PathCache,
  images?: ImageSources,
  boil?: Boil | null,
) {
  for (const r of list) {
    ctx.save();
    ctx.transform(...r.matrix);
    ctx.globalAlpha = r.opacity;
    const item = r.item;
    const jitter = boil && jitterFor(item, boil);
    if (jitter) ctx.transform(...jitter);
    switch (item.type) {
      case 'stroke': {
        const path =
          r.progress < 1
            ? outlineToPath(strokeOutline(item, r.progress, boil))
            : boil
              ? cache.getVariant(item, `${boil.variant}:${boil.amount}`, () =>
                  outlineToPath(strokeOutline(item, 1, boil)),
                )
              : cache.get(item, () => outlineToPath(strokeOutline(item)));
        ctx.globalAlpha = r.opacity * item.style.opacity;
        ctx.fillStyle = item.style.color;
        ctx.fill(path);
        break;
      }
      case 'shape':
        ctx.globalAlpha = r.opacity * item.style.opacity;
        drawShape(ctx, item, r.progress, r.fill ?? 1);
        break;
      case 'text':
        drawText(ctx, item, r.progress);
        break;
      case 'image':
        drawImageItem(ctx, item, images);
        break;
      case 'group':
        // Los grupos llegan aplanados desde evaluateScene.
        break;
    }
    ctx.restore();
  }
}

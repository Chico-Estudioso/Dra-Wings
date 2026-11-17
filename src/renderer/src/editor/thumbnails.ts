// Miniaturas de recursos renderizadas con el mismo motor que el lienzo (en caché por id).
import { createScene } from '@core/model/factory';
import type { Group, Item } from '@core/model/types';
import { drawRenderList, PathCache } from '@core/render/draw';
import { evaluateScene } from '@core/render/evaluate';
import { itemsBounds } from '@core/geometry/items';

const cache = new Map<string, string>();
const paths = new PathCache();

export function renderItemsTo(canvas: HTMLCanvasElement, items: Item[], padding = 0.1): void {
  const ctx = canvas.getContext('2d')!;
  const b = itemsBounds(items);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!b || b.w === 0 || b.h === 0) return;
  const avail = Math.min(canvas.width, canvas.height) * (1 - padding * 2);
  const s = avail / Math.max(b.w, b.h);
  const ox = (canvas.width - b.w * s) / 2 - b.x * s;
  const oy = (canvas.height - b.h * s) / 2 - b.y * s;
  const scene = createScene('vista');
  scene.layers[0]!.items = items;
  ctx.setTransform(s, 0, 0, s, ox, oy);
  drawRenderList(ctx, evaluateScene(scene, 0, { mode: 'edit' }), paths);
}

export function thumbnail(key: string, build: () => Group | Item[], size = 128): string {
  let url = cache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const built = build();
    renderItemsTo(c, Array.isArray(built) ? built : [built]);
    url = c.toDataURL('image/png');
    cache.set(key, url);
  }
  return url;
}

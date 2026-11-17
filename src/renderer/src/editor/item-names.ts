import type { Item } from '@core/model/types';

/** Nombre legible de un elemento (línea de tiempo, avisos para lectores de pantalla). */
export function itemName(item: Item): string {
  if (item.name) return item.name;
  switch (item.type) {
    case 'stroke':
      return 'Trazo';
    case 'shape':
      return 'Forma';
    case 'text':
      return `Texto «${item.text.slice(0, 20)}»`;
    case 'group':
      return 'Grupo';
    case 'image':
      return 'Imagen';
  }
}

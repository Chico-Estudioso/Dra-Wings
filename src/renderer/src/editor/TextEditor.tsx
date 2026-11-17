import { useLayoutEffect, useRef, useState } from 'react';
import { createText } from '@core/model/factory';
import { locateItem, removeItems } from '@core/edit/ops';
import { FONT_FAMILIES, measureText } from '@core/render/draw';
import type { TextItem } from '@core/model/types';
import { addToActiveLayer, currentScene, editScene } from './actions';
import { useEditor } from './editor-store';
import { fontsReady } from './fonts';
import { toScreen } from './view';
import { resolveTransform } from '@core/geometry/matrix';

export type TextEditTarget = { kind: 'new'; x: number; y: number } | { kind: 'edit'; id: string };

const LINE_HEIGHT = 1.2;
let measureCtx: CanvasRenderingContext2D | null = null;

function measure(text: string, font: TextItem['font'], size: number) {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  return measureText(measureCtx, text, font, size, LINE_HEIGHT);
}

export function TextEditor({ target, onDone }: { target: TextEditTarget; onDone: () => void }) {
  const view = useEditor((s) => s.view);
  const options = useEditor((s) => s.options);
  const existing =
    target.kind === 'edit' ? (locateItem(currentScene()!, target.id)?.item as TextItem | undefined) : undefined;
  const [text, setText] = useState(existing?.text ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  const font = existing?.font ?? options.font;
  const size = existing?.size ?? options.fontSize;
  const color = existing?.color ?? options.color;
  const playhead = useEditor((s) => s.playhead);
  const st = existing ? resolveTransform(existing.transform, playhead) : null;
  const scale = st?.scaleX ?? 1;
  const origin = target.kind === 'new' ? { x: target.x, y: target.y - size / 2 } : { x: st!.x, y: st!.y };
  const screen = toScreen(view, origin);

  // Foco inmediato (antes de pintar) para no perder las primeras teclas.
  useLayoutEffect(() => {
    if (target.kind === 'edit') useEditor.getState().setEditingText(target.id);
    const el = ref.current!;
    el.focus();
    el.select();
    return () => useEditor.getState().setEditingText(null);
  }, [target]);

  const commit = async () => {
    if (done.current) return;
    done.current = true;
    await fontsReady();
    const value = text.replace(/\s+$/, '');
    if (target.kind === 'new') {
      if (value) {
        const box = measure(value, font, size);
        const item = createText(origin.x, origin.y, {
          text: value,
          font,
          size,
          color,
          align: 'left',
          lineHeight: LINE_HEIGHT,
          ...box,
        });
        addToActiveLayer(item, 'Añadir texto', true);
      }
    } else if (existing) {
      if (!value) {
        editScene('Eliminar texto', (scene) => removeItems(scene, new Set([existing.id])));
        useEditor.getState().select([]);
      } else if (value !== existing.text) {
        const box = measure(value, existing.font, existing.size);
        editScene('Editar texto', (scene) => {
          const it = locateItem(scene, existing.id)?.item as TextItem | undefined;
          if (!it) return;
          it.text = value;
          it.w = box.w;
          it.h = box.h;
          it.transform.anchorX = box.w / 2;
          it.transform.anchorY = box.h / 2;
        });
      }
    }
    onDone();
  };

  return (
    <textarea
      ref={ref}
      className="text-editor"
      aria-label="Texto"
      value={text}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          void commit();
        }
      }}
      style={{
        left: screen.x,
        top: screen.y,
        font: `${size * view.zoom * scale}px ${FONT_FAMILIES[font]}`,
        lineHeight: LINE_HEIGHT,
        color,
      }}
    />
  );
}

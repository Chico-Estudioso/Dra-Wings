import { useState } from 'react';
import {
  BringToFront,
  Copy,
  Crosshair,
  Group as GroupIcon,
  MoveDown,
  MoveUp,
  SendToBack,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { resolveTransform, type StaticTransform } from '@core/geometry/matrix';
import { locateItem } from '@core/edit/ops';
import { worldBounds } from '@core/geometry/items';
import type { FontId, Item, Scene, TextItem } from '@core/model/types';
import type { Fps } from '@core/time/ticks';
import { measureText } from '@core/render/draw';
import {
  commitTransforms,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  recolorSelected,
  reorderSelection,
  setSelectedOpacity,
  ungroupSelection,
  updateSelected,
} from './actions';
import { AnimationSection } from './AnimationSection';
import { ColorPicker, ValueSlider } from './controls';
import { useEditor } from './editor-store';
import { FONT_LABELS, fontsReady } from './fonts';

let measureCtx: CanvasRenderingContext2D | null = null;
async function remeasure(t: TextItem) {
  await fontsReady();
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  return measureText(measureCtx, t.text, t.font, t.size, t.lineHeight);
}

function colorOf(item: Item): string | null {
  if (item.type === 'stroke') return item.style.color;
  if (item.type === 'shape') return item.style.stroke;
  if (item.type === 'text') return item.color;
  return null;
}

/** Valor que se está arrastrando en un deslizador: se aplica al soltar, en un solo paso de deshacer. */
function useDraft(initial: number) {
  const [draft, setDraft] = useState<number | null>(null);
  return { value: draft ?? initial, set: setDraft, clear: () => setDraft(null) };
}

export function PropertiesPanel({
  scene,
  docSize,
  fps,
}: {
  scene: Scene;
  docSize: { w: number; h: number };
  fps: Fps;
}) {
  const selection = useEditor((s) => s.selection);
  const items = selection.map((id) => locateItem(scene, id)?.item).filter((i): i is Item => !!i);
  const first = items[0];
  const allStrokes = items.length > 0 && items.every((i) => i.type === 'stroke');
  const allShapes = items.length > 0 && items.every((i) => i.type === 'shape');
  const allTexts = items.length > 0 && items.every((i) => i.type === 'text');
  const singleGroup = items.length === 1 && first?.type === 'group' ? first : null;

  const size = useDraft(
    first?.type === 'stroke'
      ? first.style.size
      : first?.type === 'shape'
        ? first.style.strokeWidth
        : first?.type === 'text'
          ? first.size
          : 1,
  );
  const opacity = useDraft(first && 'value' in first.opacity ? first.opacity.value : 1);

  if (!first) return null;

  const setColor = (c: string | null) =>
    updateSelected('Cambiar color', (it) => {
      if (it.type === 'stroke' && c) it.style.color = c;
      else if (it.type === 'shape') it.style.stroke = c;
      else if (it.type === 'text' && c) it.color = c;
    });

  const commitSize = async (v: number) => {
    size.clear();
    if (allTexts) {
      const boxes = new Map<string, { w: number; h: number }>();
      for (const it of items as TextItem[]) boxes.set(it.id, await remeasure({ ...it, size: v }));
      updateSelected('Tamaño del texto', (it) => {
        if (it.type !== 'text') return;
        const b = boxes.get(it.id)!;
        Object.assign(it, { size: v, w: b.w, h: b.h });
        it.transform.anchorX = b.w / 2;
        it.transform.anchorY = b.h / 2;
      });
    } else
      updateSelected('Cambiar grosor', (it) => {
        if (it.type === 'stroke') it.style.size = v;
        else if (it.type === 'shape') it.style.strokeWidth = v;
      });
  };

  const center = () => {
    const t = useEditor.getState().playhead;
    const next = new Map<string, StaticTransform>();
    for (const it of items) {
      const b = worldBounds(it, t);
      const st = resolveTransform(it.transform, t);
      next.set(it.id, { ...st, x: st.x + docSize.w / 2 - (b.x + b.w / 2), y: st.y + docSize.h / 2 - (b.y + b.h / 2) });
    }
    commitTransforms('Centrar en el lienzo', next);
  };

  const kind = allStrokes
    ? 'Trazo'
    : allShapes
      ? 'Forma'
      : allTexts
        ? 'Texto'
        : singleGroup
          ? (singleGroup.name ?? 'Grupo')
          : 'Elementos';

  return (
    <section className="panel" aria-labelledby="props-title">
      <header className="panel-header">
        <h2 id="props-title" className="panel-title">
          {items.length > 1 ? `${items.length} ${kind === 'Elementos' ? 'elementos' : kind.toLowerCase() + 's'}` : kind}
        </h2>
      </header>
      <div className="panel-body">
        {singleGroup
          ? singleGroup.slots?.map((slot) => (
              <ColorPicker
                key={slot.id}
                label={slot.label}
                value={slot.color}
                onChange={(c) => c && recolorSelected(slot.id, c)}
              />
            ))
          : (allStrokes || allShapes || allTexts) && (
              <ColorPicker
                label={allShapes ? 'Borde' : 'Color'}
                value={colorOf(first)}
                allowNone={allShapes}
                onChange={setColor}
              />
            )}
        {allShapes && first.type === 'shape' && (first.shape === 'rect' || first.shape === 'ellipse') && (
          <ColorPicker
            label="Relleno"
            value={first.style.fill}
            allowNone
            onChange={(c) =>
              updateSelected('Cambiar relleno', (it) => void (it.type === 'shape' && (it.style.fill = c)))
            }
          />
        )}
        {(allStrokes || allShapes || allTexts) && (
          <ValueSlider
            label={allTexts ? 'Tamaño' : 'Grosor'}
            value={size.value}
            min={allTexts ? 12 : 1}
            max={allTexts ? 240 : 80}
            onChange={size.set}
            onCommit={(v) => void commitSize(v)}
          />
        )}
        {allTexts && first.type === 'text' && (
          <label className="inline-field">
            <span className="control-label">Fuente</span>
            <select
              className="input input-sm"
              value={first.font}
              onChange={async (e) => {
                const font = e.target.value as FontId;
                const boxes = new Map<string, { w: number; h: number }>();
                for (const it of items as TextItem[]) boxes.set(it.id, await remeasure({ ...it, font }));
                updateSelected('Cambiar fuente', (it) => {
                  if (it.type !== 'text') return;
                  const b = boxes.get(it.id)!;
                  Object.assign(it, { font, w: b.w, h: b.h });
                  it.transform.anchorX = b.w / 2;
                  it.transform.anchorY = b.h / 2;
                });
              }}
            >
              {(Object.keys(FONT_LABELS) as FontId[]).map((f) => (
                <option key={f} value={f}>
                  {FONT_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
        )}
        <ValueSlider
          label="Opacidad"
          value={opacity.value}
          min={0.05}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)} %`}
          onChange={opacity.set}
          onCommit={(v) => {
            opacity.clear();
            setSelectedOpacity(v);
          }}
        />
        <div className="button-grid" role="group" aria-label="Organizar">
          <button
            className="icon-btn"
            title="Traer al frente"
            aria-label="Traer al frente"
            onClick={() => reorderSelection('front')}
          >
            <BringToFront size={17} />
          </button>
          <button className="icon-btn" title="Subir" aria-label="Subir" onClick={() => reorderSelection('forward')}>
            <MoveUp size={17} />
          </button>
          <button className="icon-btn" title="Bajar" aria-label="Bajar" onClick={() => reorderSelection('backward')}>
            <MoveDown size={17} />
          </button>
          <button
            className="icon-btn"
            title="Enviar al fondo"
            aria-label="Enviar al fondo"
            onClick={() => reorderSelection('back')}
          >
            <SendToBack size={17} />
          </button>
          <button className="icon-btn" title="Centrar en el lienzo" aria-label="Centrar en el lienzo" onClick={center}>
            <Crosshair size={17} />
          </button>
          {items.length > 1 && (
            <button className="icon-btn" title="Agrupar (Ctrl+G)" aria-label="Agrupar" onClick={groupSelection}>
              <GroupIcon size={17} />
            </button>
          )}
          {items.some((i) => i.type === 'group') && (
            <button
              className="icon-btn"
              title="Desagrupar (Ctrl+Mayús+G)"
              aria-label="Desagrupar"
              onClick={ungroupSelection}
            >
              <Ungroup size={17} />
            </button>
          )}
          <button className="icon-btn" title="Duplicar (Ctrl+D)" aria-label="Duplicar" onClick={duplicateSelection}>
            <Copy size={17} />
          </button>
          <button className="icon-btn" title="Eliminar (Supr)" aria-label="Eliminar" onClick={deleteSelection}>
            <Trash2 size={17} />
          </button>
        </div>
        <AnimationSection items={items} fps={fps} />
      </div>
    </section>
  );
}

import type { FontId } from '@core/model/types';
import { ColorPicker, ValueSlider } from './controls';
import { useEditor } from './editor-store';
import { resetCamera } from './actions';
import { FONT_LABELS } from './fonts';
import { TOOLS } from './Toolbar';

const pct = (v: number) => `${Math.round(v * 100)} %`;

/**
 * Opciones de la herramienta activa. La barra tiene altura fija (con una ayuda breve cuando la
 * herramienta no tiene opciones) para que el lienzo no cambie de tamaño al cambiar de herramienta.
 */
const CAMERA_HINT =
  'Arrastra el marco para encuadrar; la esquina inferior derecha hace zoom. Con «Grabar movimiento» crea keyframes en el cabezal.';

const PUPPET_HINT =
  'Animar arrastrando: arrastra un elemento y el vídeo avanzará grabando su recorrido. Suelta para terminar; Esc cancela.';

export function ToolOptions() {
  const tool = useEditor((s) => s.tool);
  const o = useEditor((s) => s.options);
  const set = useEditor((s) => s.setOptions);
  const hasSelection = useEditor((s) => s.selection.length > 0);
  const puppet = useEditor((s) => s.puppet);
  const label = TOOLS.find((t) => t.id === tool)?.label;

  if (tool === 'camera')
    return (
      <div className="tool-options" role="note">
        <span className="tool-hint" title={CAMERA_HINT}>
          {CAMERA_HINT}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={resetCamera}>
          Restablecer encuadre
        </button>
      </div>
    );
  if (tool === 'select' && puppet)
    return (
      <div className="tool-options" role="note">
        <span className="tool-hint" title={PUPPET_HINT}>
          {PUPPET_HINT}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => useEditor.getState().setPuppet(false)}>
          Dejar de animar
        </button>
      </div>
    );
  const hint =
    tool === 'hand'
      ? 'Arrastra para desplazar el lienzo. Ctrl + rueda para acercar o alejar.'
      : hasSelection
        ? 'Arrastra para mover. Usa los tiradores para escalar y rotar (Mayús mantiene la proporción y gira de 15 en 15°).'
        : 'Haz clic en un elemento para seleccionarlo, o arrastra para seleccionar varios.';
  if (tool === 'select' || tool === 'hand')
    return (
      <div className="tool-options" role="note">
        <span className="tool-hint" title={hint}>
          {hint}
        </span>
      </div>
    );
  return (
    <div className="tool-options" role="toolbar" aria-label={`Opciones de ${label}`}>
      {tool === 'eraser' ? (
        <ValueSlider label="Tamaño" value={o.eraserSize} min={4} max={200} onChange={(v) => set({ eraserSize: v })} />
      ) : (
        <ColorPicker label="Color" value={o.color} onChange={(c) => c && set({ color: c })} />
      )}
      {tool === 'pencil' && (
        <>
          <ValueSlider label="Grosor" value={o.size} min={1} max={80} onChange={(v) => set({ size: v })} />
          <ValueSlider
            label="Opacidad"
            value={o.opacity}
            min={0.05}
            max={1}
            step={0.05}
            format={pct}
            onChange={(v) => set({ opacity: v })}
          />
        </>
      )}
      {(tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'arrow') && (
        <>
          <ValueSlider
            label="Grosor"
            value={o.strokeWidth}
            min={1}
            max={60}
            onChange={(v) => set({ strokeWidth: v })}
          />
          {(tool === 'rect' || tool === 'ellipse') && (
            <ColorPicker label="Relleno" value={o.fill} allowNone onChange={(c) => set({ fill: c })} />
          )}
        </>
      )}
      {tool === 'text' && (
        <>
          <label className="inline-field">
            <span className="control-label">Fuente</span>
            <select className="input input-sm" value={o.font} onChange={(e) => set({ font: e.target.value as FontId })}>
              {(Object.keys(FONT_LABELS) as FontId[]).map((f) => (
                <option key={f} value={f}>
                  {FONT_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <ValueSlider label="Tamaño" value={o.fontSize} min={12} max={240} onChange={(v) => set({ fontSize: v })} />
        </>
      )}
    </div>
  );
}

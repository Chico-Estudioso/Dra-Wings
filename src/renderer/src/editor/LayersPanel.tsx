import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Film, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import type { Scene } from '@core/model/types';
import { addFramesLayer, addLayerAboveActive, deleteLayer, layerItemCount, shiftLayer, updateLayer } from './actions';
import { useEditor } from './editor-store';

function LayerName({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const rename = () => {
    setDraft(name);
    setEditing(true);
  };
  if (!editing)
    return (
      <button
        className="layer-name"
        aria-pressed={active}
        title="Clic para dibujar en esta capa · doble clic o F2 para renombrar"
        onClick={() => useEditor.getState().setActiveLayer(id)}
        onDoubleClick={rename}
        onKeyDown={(e) => e.key === 'F2' && rename()}
      >
        {name}
      </button>
    );
  const commit = () => {
    const v = draft.trim();
    if (v && v !== name) updateLayer(id, 'Renombrar capa', (l) => void (l.name = v));
    setEditing(false);
  };
  return (
    <input
      className="input input-sm layer-name-input"
      aria-label="Nombre de la capa"
      autoFocus
      value={draft}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

export function LayersPanel({ scene }: { scene: Scene }) {
  const active = useEditor((s) => s.activeLayerId);
  const setActive = useEditor((s) => s.setActiveLayer);
  const layers = [...scene.layers].reverse(); // la de arriba primero
  const activeIdx = scene.layers.findIndex((l) => l.id === active);

  return (
    <section className="panel" aria-labelledby="layers-title">
      <header className="panel-header">
        <h2 id="layers-title" className="panel-title">
          Capas
        </h2>
        <div className="panel-actions">
          <button
            className="icon-btn icon-btn-sm"
            aria-label="Subir capa"
            title="Subir capa"
            disabled={activeIdx < 0 || activeIdx === scene.layers.length - 1}
            onClick={() => active && shiftLayer(active, 'up')}
          >
            <ArrowUp size={16} />
          </button>
          <button
            className="icon-btn icon-btn-sm"
            aria-label="Bajar capa"
            title="Bajar capa"
            disabled={activeIdx <= 0}
            onClick={() => active && shiftLayer(active, 'down')}
          >
            <ArrowDown size={16} />
          </button>
          <button
            className="icon-btn icon-btn-sm"
            aria-label="Nueva capa de fotogramas"
            title="Nueva capa de fotogramas (animación dibujo a dibujo)"
            onClick={addFramesLayer}
          >
            <Film size={16} />
          </button>
          <button
            className="icon-btn icon-btn-sm"
            aria-label="Nueva capa"
            title="Nueva capa"
            onClick={addLayerAboveActive}
          >
            <Plus size={16} />
          </button>
        </div>
      </header>
      <ul className="layer-list" aria-label="Capas de la escena">
        {layers.map((l) => (
          <li
            key={l.id}
            className={`layer ${l.id === active ? 'is-active' : ''} ${l.visible ? '' : 'is-hidden'}`}
            onClick={() => setActive(l.id)}
          >
            <button
              className="icon-btn icon-btn-sm"
              aria-label={l.visible ? `Ocultar ${l.name}` : `Mostrar ${l.name}`}
              title={l.visible ? 'Ocultar' : 'Mostrar'}
              onClick={(e) => {
                e.stopPropagation();
                updateLayer(l.id, l.visible ? 'Ocultar capa' : 'Mostrar capa', (x) => void (x.visible = !x.visible));
              }}
            >
              {l.visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <LayerName id={l.id} name={l.name} active={l.id === active} />
            {l.kind === 'frames' && <Film size={13} aria-label="Capa de fotogramas" />}
            <span className="layer-count">{layerItemCount(l)}</span>
            <button
              className={`icon-btn icon-btn-sm ${l.locked ? 'is-on' : ''}`}
              aria-label={l.locked ? `Desbloquear ${l.name}` : `Bloquear ${l.name}`}
              title={l.locked ? 'Desbloquear' : 'Bloquear'}
              onClick={(e) => {
                e.stopPropagation();
                updateLayer(l.id, l.locked ? 'Desbloquear capa' : 'Bloquear capa', (x) => void (x.locked = !x.locked));
              }}
            >
              {l.locked ? <Lock size={16} /> : <LockOpen size={16} />}
            </button>
            <button
              className="icon-btn icon-btn-sm"
              aria-label={`Eliminar ${l.name}`}
              title="Eliminar capa"
              onClick={(e) => {
                e.stopPropagation();
                deleteLayer(l.id);
              }}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

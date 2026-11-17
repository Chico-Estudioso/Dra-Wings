import { useCallback, useEffect, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import {
  Check,
  CircleAlert,
  Grid3x3,
  Home as HomeIcon,
  Loader2,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import { formatTimecode } from '@core/time/ticks';
import type { Mode } from '@core/model/types';
import { useApp, type SaveStatus } from '../state/app-store';
import { saveCurrent } from '../state/doc-actions';
import { requestLeave } from '../state/leave-guard';
import { MODES } from '../modes';
import { useEditor } from '../editor/editor-store';
import { CanvasView } from '../editor/CanvasView';
import { Toolbar } from '../editor/Toolbar';
import { ToolOptions } from '../editor/ToolOptions';
import { LayersPanel } from '../editor/LayersPanel';
import { PropertiesPanel } from '../editor/PropertiesPanel';
import { useEditorShortcuts } from '../editor/shortcuts';
import { zoomAt } from '../editor/view';

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: 'Guardado',
  unsaved: 'Cambios sin guardar',
  saving: 'Guardando…',
  error: 'Error al guardar',
};

function SaveIndicator({ status }: { status: SaveStatus }) {
  const Icon = status === 'saved' ? Check : status === 'saving' ? Loader2 : status === 'error' ? CircleAlert : null;
  return (
    <span className={`save-indicator is-${status}`} role="status" data-testid="save-status">
      {Icon ? (
        <Icon size={14} aria-hidden className={status === 'saving' ? 'spin' : undefined} />
      ) : (
        <span className="dot" aria-hidden />
      )}
      {SAVE_LABEL[status]}
    </span>
  );
}

function ProjectName() {
  const name = useApp((s) => s.doc!.project.name);
  const apply = useApp((s) => s.apply);
  const [draft, setDraft] = useState(name);
  const [prevName, setPrevName] = useState(name);
  if (name !== prevName) {
    setPrevName(name);
    setDraft(name);
  }
  const commit = () => {
    const v = draft.trim();
    if (!v) return setDraft(name);
    if (v !== name) apply('Renombrar proyecto', (p) => void (p.name = v));
  };
  return (
    <input
      className="project-name"
      aria-label="Nombre del proyecto"
      value={draft}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(name);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function ZoomControls() {
  const view = useEditor((s) => s.view);
  const setView = useEditor((s) => s.setView);
  const zoomBy = (f: number) => {
    const host = document.querySelector('[data-testid="canvas-host"]')?.getBoundingClientRect();
    setView(zoomAt(view, f, { x: (host?.width ?? 0) / 2, y: (host?.height ?? 0) / 2 }));
  };
  return (
    <div className="zoom-controls" role="group" aria-label="Zoom">
      <button
        className="icon-btn icon-btn-sm"
        aria-label="Alejar"
        title="Alejar (Ctrl -)"
        onClick={() => zoomBy(1 / 1.25)}
      >
        <Minus size={14} />
      </button>
      <span className="zoom-value" data-testid="zoom-value">
        {Math.round(view.zoom * 100)} %
      </span>
      <button
        className="icon-btn icon-btn-sm"
        aria-label="Acercar"
        title="Acercar (Ctrl +)"
        onClick={() => zoomBy(1.25)}
      >
        <Plus size={14} />
      </button>
      <button
        className="icon-btn icon-btn-sm"
        aria-label="Ajustar a la ventana"
        title="Ajustar (Ctrl 0)"
        onClick={() => setView({ fit: true })}
      >
        <Maximize size={14} />
      </button>
    </div>
  );
}

export function Editor() {
  const project = useApp((s) => s.doc!.project);
  const projectId = project.id;
  const status = useApp((s) => s.doc!.saveStatus);
  const canUndo = useApp((s) => s.past.length > 0);
  const canRedo = useApp((s) => s.future.length > 0);
  const { apply, undo, redo, closeDoc } = useApp.getState();
  const sceneId = useEditor((s) => s.sceneId);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const showGrid = useEditor((s) => s.showGrid);
  const toggleGrid = useEditor((s) => s.toggleGrid);

  // Al abrir otro proyecto, se reinicia el estado del editor.
  useEffect(() => {
    const p = useApp.getState().doc!.project;
    const scene = p.scenes[0]!;
    useEditor.getState().reset(scene.id, scene.layers[scene.layers.length - 1]!.id, p.settings.mode);
  }, [projectId]);

  const scene = project.scenes.find((s) => s.id === sceneId) ?? project.scenes[0]!;

  // Si la capa activa desaparece (deshacer, eliminar), se elige la superior.
  useEffect(() => {
    if (!scene.layers.some((l) => l.id === activeLayerId))
      useEditor.getState().setActiveLayer(scene.layers[scene.layers.length - 1]!.id);
  }, [scene, activeLayerId]);

  const viewport = useCallback(() => {
    const r = document.querySelector('[data-testid="canvas-host"]')?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0 };
  }, []);
  useEditorShortcuts(viewport);

  return (
    <div className="editor">
      <header className="topbar">
        <button className="icon-btn" aria-label="Ir a inicio" title="Inicio" onClick={() => requestLeave(closeDoc)}>
          <HomeIcon size={18} />
        </button>
        <ProjectName />
        <SaveIndicator status={status} />
        <div className="topbar-spacer" />
        <ToggleGroup.Root
          type="single"
          className="mode-switch"
          aria-label="Modo de trabajo"
          value={project.settings.mode}
          onValueChange={(v) => v && apply('Cambiar modo', (p) => void (p.settings.mode = v as Mode))}
        >
          {MODES.map((m) => (
            <ToggleGroup.Item key={m.id} value={m.id} className="mode-item" title={m.description}>
              <m.icon size={16} aria-hidden />
              {m.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <div className="topbar-spacer" />
        <button className="icon-btn" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} />
        </button>
        <button className="icon-btn" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} />
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => void saveCurrent(false)} title="Guardar (Ctrl+S)">
          <Save size={16} aria-hidden /> Guardar
        </button>
      </header>

      <div className="workspace">
        <Toolbar />
        <div className="canvas-column">
          <ToolOptions />
          <CanvasView project={project} />
        </div>
        <aside className="sidepanel" aria-label="Paneles">
          <LayersPanel scene={scene} />
          <PropertiesPanel scene={scene} docSize={{ w: project.settings.width, h: project.settings.height }} />
        </aside>
      </div>

      <footer className="statusbar">
        <span>{scene.name}</span>
        <span>Duración {formatTimecode(scene.duration, project.settings.fps)}</span>
        <span>
          {project.settings.width} × {project.settings.height} · {project.settings.fps} fps
        </span>
        <span className="statusbar-spacer" />
        <button
          className={`icon-btn icon-btn-sm ${showGrid ? 'is-on' : ''}`}
          aria-pressed={showGrid}
          aria-label="Cuadrícula"
          title="Cuadrícula"
          onClick={toggleGrid}
        >
          <Grid3x3 size={14} />
        </button>
        <ZoomControls />
      </footer>
    </div>
  );
}

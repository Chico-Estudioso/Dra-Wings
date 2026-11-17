import { useCallback, useEffect, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import {
  Check,
  CircleAlert,
  Grid3x3,
  Home as HomeIcon,
  Loader2,
  Magnet,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
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
import { LibraryPanel } from '../editor/LibraryPanel';
import { GuidedTips } from '../editor/GuidedTips';
import { Timeline } from '../editor/Timeline';
import { usePlayback } from '../editor/playback';
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
  const snap = useEditor((s) => s.snap);
  const toggleSnap = useEditor((s) => s.toggleSnap);
  const sideTab = useEditor((s) => s.sideTab);
  const setSideTab = useEditor((s) => s.setSideTab);

  // Al abrir otro proyecto, se reinicia el estado del editor.
  useEffect(() => {
    const p = useApp.getState().doc!.project;
    const scene = p.scenes[0]!;
    useEditor.getState().reset(scene.id, scene.layers[scene.layers.length - 1]!.id, p.settings.mode);
  }, [projectId]);

  const scene = project.scenes.find((s) => s.id === sceneId) ?? project.scenes[0]!;

  // Si la escena o la capa activa desaparecen (deshacer, eliminar), se elige otra.
  useEffect(() => {
    if (sceneId && scene.id !== sceneId)
      useEditor.getState().setScene(scene.id, scene.layers[scene.layers.length - 1]!.id);
    else if (!scene.layers.some((l) => l.id === activeLayerId))
      useEditor.getState().setActiveLayer(scene.layers[scene.layers.length - 1]!.id);
  }, [scene, sceneId, activeLayerId]);

  usePlayback();

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
          onValueChange={(v) => {
            if (!v) return;
            apply('Cambiar modo', (p) => void (p.settings.mode = v as Mode));
            useEditor.getState().applyModeDefaults(v as Mode);
          }}
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
          <div className="canvas-area">
            <CanvasView project={project} />
          </div>
        </div>
        <aside className="sidepanel" aria-label="Paneles">
          {project.settings.mode === 'guided' && <GuidedTips />}
          <div className="side-tabs" role="tablist" aria-label="Paneles laterales">
            <button
              role="tab"
              aria-selected={sideTab === 'library'}
              className={`side-tab ${sideTab === 'library' ? 'is-active' : ''}`}
              onClick={() => setSideTab('library')}
            >
              Biblioteca
            </button>
            <button
              role="tab"
              aria-selected={sideTab === 'layers'}
              className={`side-tab ${sideTab === 'layers' ? 'is-active' : ''}`}
              onClick={() => setSideTab('layers')}
            >
              Capas
            </button>
          </div>
          <PropertiesPanel
            scene={scene}
            docSize={{ w: project.settings.width, h: project.settings.height }}
            fps={project.settings.fps}
          />
          {sideTab === 'library' ? <LibraryPanel project={project} /> : <LayersPanel scene={scene} />}
        </aside>
      </div>

      <Timeline project={project} scene={scene} />

      <footer className="statusbar">
        <span>{scene.name}</span>
        <span data-testid="item-count">
          {(() => {
            const n = scene.layers.reduce((acc, l) => acc + (l.items?.length ?? 0), 0);
            return `${n} ${n === 1 ? 'elemento' : 'elementos'}`;
          })()}
        </span>
        <span>
          {project.settings.width} × {project.settings.height} · {project.settings.fps} fps
        </span>
        <span className="statusbar-spacer" />
        <button
          className={`icon-btn icon-btn-sm ${snap ? 'is-on' : ''}`}
          aria-pressed={snap}
          aria-label="Guías magnéticas"
          title="Guías magnéticas al mover (Alt para desactivarlas al arrastrar)"
          onClick={toggleSnap}
        >
          <Magnet size={14} />
        </button>
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

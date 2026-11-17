import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Check, CircleAlert, Home as HomeIcon, Loader2, Redo2, Save, Undo2 } from 'lucide-react';
import { formatTimecode } from '@core/time/ticks';
import type { Mode } from '@core/model/types';
import { useApp, type SaveStatus } from '../state/app-store';
import { saveCurrent } from '../state/doc-actions';
import { requestLeave } from '../state/leave-guard';
import { MODES } from '../modes';

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

/** Hoja de papel con la proporción del proyecto, ajustada al espacio disponible. */
function Stage({ width, height, background }: { width: number; height: number; background: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min((box.w - 64) / width, (box.h - 64) / height, 1);
  const w = Math.max(0, width * scale);
  const h = Math.max(0, height * scale);
  return (
    <div className="stage" ref={ref}>
      <div className="paper" style={{ width: w, height: h, background }} data-testid="paper" />
      <span className="stage-zoom">{Math.round(scale * 100)} %</span>
    </div>
  );
}

function isEditable(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

export function Editor() {
  const project = useApp((s) => s.doc!.project);
  const status = useApp((s) => s.doc!.saveStatus);
  const canUndo = useApp((s) => s.past.length > 0);
  const canRedo = useApp((s) => s.future.length > 0);
  const { apply, undo, redo, closeDoc } = useApp.getState();
  const scene = project.scenes[0]!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isEditable(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

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

      <Stage width={project.settings.width} height={project.settings.height} background={project.settings.background} />

      <footer className="statusbar">
        <span>{scene.name}</span>
        <span>Duración {formatTimecode(scene.duration, project.settings.fps)}</span>
        <span>
          {project.settings.width} × {project.settings.height} · {project.settings.fps} fps
        </span>
      </footer>
    </div>
  );
}

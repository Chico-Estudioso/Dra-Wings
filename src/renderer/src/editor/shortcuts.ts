// Atajos de teclado del editor (no actúan mientras se escribe en un campo de texto).
import { useEffect } from 'react';
import { useApp } from '../state/app-store';
import { ticksPerFrame } from '@core/time/ticks';
import { selectionKeyTimes } from './actions';
import { togglePlay } from './playback';
import {
  deleteSelection,
  duplicateSelection,
  groupSelection,
  nudgeSelection,
  selectAll,
  ungroupSelection,
} from './actions';
import { useEditor, type Tool } from './editor-store';
import { zoomAt } from './view';
import { addMarkerAtPlayhead, deleteClip, deleteMarker } from './media-actions';
import { openShortcuts } from './ShortcutsDialog';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  b: 'pencil',
  p: 'pencil',
  e: 'eraser',
  r: 'rect',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  t: 'text',
  h: 'hand',
  c: 'camera',
};

function isEditable(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

export function useEditorShortcuts(viewport: () => { w: number; h: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target) || e.defaultPrevented) return;
      const ed = useEditor.getState();
      const app = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod) {
        if (k === 'z' && !e.shiftKey) app.undo();
        else if (k === 'y' || (k === 'z' && e.shiftKey)) app.redo();
        else if (k === 'd') duplicateSelection();
        else if (k === 'g') (e.shiftKey ? ungroupSelection : groupSelection)();
        else if (k === 'a') selectAll();
        else if (k === '0') ed.setView({ fit: true });
        else if (k === '=' || k === '+' || k === '-') {
          const v = viewport();
          ed.setView(zoomAt(ed.view, k === '-' ? 1 / 1.25 : 1.25, { x: v.w / 2, y: v.h / 2 }));
        } else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;
      if (e.key === '?' || e.key === 'F1') {
        openShortcuts();
        e.preventDefault();
        return;
      }
      const fps = app.doc?.project.settings.fps ?? 30;
      if (k === 'enter') togglePlay();
      else if (k === 'home') ed.setPlayhead(0);
      else if ((k === ',' || k === '.' || k === ';' || k === ':') && e.shiftKey) {
        const keys = selectionKeyTimes();
        const fwd = k === '.' || k === ':';
        const target = fwd ? keys.find((t) => t > ed.playhead) : [...keys].reverse().find((t) => t < ed.playhead);
        if (target !== undefined) ed.setPlayhead(target);
      } else if (k === ',' || k === '.') {
        ed.setPreview(true);
        ed.setPlayhead(ed.playhead + (k === '.' ? 1 : -1) * ticksPerFrame(fps));
      } else if (k === 'delete' || k === 'backspace') {
        if (ed.clipId) deleteClip(ed.clipId);
        else if (ed.markerId) deleteMarker(ed.markerId);
        else deleteSelection();
      } else if (k === 'escape') ed.select([]);
      else if (k === 'm') addMarkerAtPlayhead();
      else if (k.startsWith('arrow')) {
        const d = e.shiftKey ? 10 : 1;
        nudgeSelection(
          k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0,
          k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0,
        );
      } else if (k === '[' || k === ']') {
        const f = k === ']' ? 1.2 : 1 / 1.2;
        if (ed.tool === 'eraser')
          ed.setOptions({ eraserSize: Math.round(Math.min(200, Math.max(4, ed.options.eraserSize * f))) });
        else ed.setOptions({ size: Math.round(Math.min(80, Math.max(1, ed.options.size * f))) });
      } else if (TOOL_KEYS[k]) ed.setTool(TOOL_KEYS[k]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewport]);
}

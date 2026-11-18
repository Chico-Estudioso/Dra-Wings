// Estado de la interfaz y del documento abierto. Las ediciones pasan por `apply`, que registra
// parches inversos para deshacer y rehacer.
import { create } from 'zustand';
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import type { Project } from '@core/model/types';

enablePatches();

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export interface OpenDoc {
  project: Project;
  filePath: string | null;
  dirty: boolean;
  saveStatus: SaveStatus;
}

interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
}

export interface Notice {
  kind: 'error' | 'info';
  text: string;
  details?: string[];
  /** Botón opcional junto al aviso (por ejemplo, «Mostrar en la carpeta»). */
  action?: { label: string; run: () => void };
}

interface AppState {
  screen: 'home' | 'editor';
  doc: OpenDoc | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  notice: Notice | null;
  newProjectOpen: boolean;

  openDoc(project: Project, filePath: string | null, opts?: { dirty?: boolean }): void;
  closeDoc(): void;
  apply(label: string, recipe: (draft: Project) => void): void;
  undo(): void;
  redo(): void;
  setSaveStatus(status: SaveStatus): void;
  /** `snapshot` es el proyecto que se envió a guardar; si hubo ediciones durante el guardado, sigue sucio. */
  markSaved(filePath: string, savedAt: string, snapshot: Project): void;
  notify(notice: Notice | null): void;
  setNewProjectOpen(open: boolean): void;
}

const HISTORY_LIMIT = 200;

export const useApp = create<AppState>()((set, get) => ({
  screen: 'home',
  doc: null,
  past: [],
  future: [],
  notice: null,
  newProjectOpen: false,

  openDoc: (project, filePath, opts = {}) =>
    set({
      screen: 'editor',
      doc: { project, filePath, dirty: !!opts.dirty, saveStatus: opts.dirty ? 'unsaved' : 'saved' },
      past: [],
      future: [],
      notice: null,
    }),

  closeDoc: () => set({ screen: 'home', doc: null, past: [], future: [] }),

  apply: (label, recipe) => {
    const doc = get().doc;
    if (!doc) return;
    const [next, patches, inverse] = produceWithPatches(doc.project, recipe);
    if (patches.length === 0) return;
    set({
      doc: { ...doc, project: next, dirty: true, saveStatus: 'unsaved' },
      past: [...get().past, { label, patches, inverse }].slice(-HISTORY_LIMIT),
      future: [],
    });
  },

  undo: () => {
    const { doc, past, future } = get();
    const entry = past[past.length - 1];
    if (!doc || !entry) return;
    set({
      doc: { ...doc, project: applyPatches(doc.project, entry.inverse), dirty: true, saveStatus: 'unsaved' },
      past: past.slice(0, -1),
      future: [entry, ...future],
    });
  },

  redo: () => {
    const { doc, past, future } = get();
    const entry = future[0];
    if (!doc || !entry) return;
    set({
      doc: { ...doc, project: applyPatches(doc.project, entry.patches), dirty: true, saveStatus: 'unsaved' },
      past: [...past, entry],
      future: future.slice(1),
    });
  },

  setSaveStatus: (status) => {
    const doc = get().doc;
    if (doc) set({ doc: { ...doc, saveStatus: status } });
  },

  markSaved: (filePath, savedAt, snapshot) => {
    const doc = get().doc;
    if (!doc) return;
    if (doc.project === snapshot) {
      set({
        doc: { ...doc, filePath, dirty: false, saveStatus: 'saved', project: { ...doc.project, updatedAt: savedAt } },
      });
    } else {
      set({ doc: { ...doc, filePath, saveStatus: 'unsaved' } });
    }
  },

  notify: (notice) => set({ notice }),
  setNewProjectOpen: (open) => set({ newProjectOpen: open }),
}));

// Estado de edición que no forma parte del documento (no se guarda ni se deshace):
// herramienta, opciones, selección, capa activa y vista.
import { create } from 'zustand';
import type { FontId, Mode, Shape } from '@core/model/types';

export type Tool = 'select' | 'pencil' | 'eraser' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'hand';

export const SHAPE_TOOLS: Record<string, Shape['shape']> = {
  rect: 'rect',
  ellipse: 'ellipse',
  line: 'line',
  arrow: 'arrow',
};

export interface ToolOptions {
  color: string;
  fill: string | null;
  size: number;
  eraserSize: number;
  opacity: number;
  strokeWidth: number;
  font: FontId;
  fontSize: number;
}

export interface View {
  zoom: number;
  panX: number;
  panY: number;
  /** Mientras sea true, la vista se reajusta al tamaño de la ventana. */
  fit: boolean;
}

export const PALETTE = [
  '#1d1d1f',
  '#6b665c',
  '#ffffff',
  '#c23b4e',
  '#d9622b',
  '#e0a526',
  '#3f8f4f',
  '#2f6fd6',
  '#7b4bb7',
  '#8a5a3b',
];

interface EditorState {
  tool: Tool;
  options: ToolOptions;
  selection: string[];
  sceneId: string | null;
  activeLayerId: string | null;
  view: View;
  showGrid: boolean;
  editingTextId: string | null;

  setTool(tool: Tool): void;
  setOptions(patch: Partial<ToolOptions>): void;
  select(ids: string[]): void;
  setActiveLayer(id: string): void;
  setView(view: Partial<View>): void;
  toggleGrid(): void;
  setEditingText(id: string | null): void;
  reset(sceneId: string, layerId: string, mode: Mode): void;
}

export const useEditor = create<EditorState>()((set) => ({
  tool: 'pencil',
  options: {
    color: '#1d1d1f',
    fill: null,
    size: 8,
    eraserSize: 24,
    opacity: 1,
    strokeWidth: 6,
    font: 'hand',
    fontSize: 64,
  },
  selection: [],
  sceneId: null,
  activeLayerId: null,
  view: { zoom: 1, panX: 0, panY: 0, fit: true },
  showGrid: false,
  editingTextId: null,

  setTool: (tool) => set((s) => ({ tool, selection: tool === 'select' ? s.selection : [], editingTextId: null })),
  setOptions: (patch) => set((s) => ({ options: { ...s.options, ...patch } })),
  select: (ids) => set({ selection: ids }),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setView: (view) => set((s) => ({ view: { ...s.view, ...view } })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setEditingText: (id) => set({ editingTextId: id }),
  reset: (sceneId, layerId, mode) =>
    set({
      sceneId,
      activeLayerId: layerId,
      selection: [],
      editingTextId: null,
      tool: mode === 'guided' ? 'select' : 'pencil',
      view: { zoom: 1, panX: 0, panY: 0, fit: true },
    }),
}));

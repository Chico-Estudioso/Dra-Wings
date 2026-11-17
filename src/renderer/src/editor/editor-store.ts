// Estado de edición que no forma parte del documento (no se guarda ni se deshace):
// herramienta, opciones, selección, capa activa y vista.
import { create } from 'zustand';
import type { FontId, Mode, Shape } from '@core/model/types';
import type { Ticks } from '@core/time/ticks';

export type Tool = 'select' | 'pencil' | 'eraser' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'hand' | 'camera';

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
  /** Guías y ajuste magnético al mover (activo por defecto en Guiado y Mixto). */
  snap: boolean;
  sideTab: 'library' | 'layers';
  editingTextId: string | null;
  /** Cabezal: instante dentro de la escena actual. */
  playhead: Ticks;
  playing: boolean;
  /** Vista previa: el lienzo muestra el vídeo en el cabezal (apariciones y cámara). */
  preview: boolean;
  /** Grabar movimiento: los cambios en un instante posterior a la aparición crean keyframes. */
  autoKey: boolean;
  /** Papel cebolla en capas de fotogramas. */
  onion: boolean;
  /** Píxeles por segundo en la línea de tiempo. */
  timelineZoom: number;
  /** Alto de la línea de tiempo elegido por el usuario (null: el predeterminado). */
  timelineHeight: number | null;

  setTool(tool: Tool): void;
  setOptions(patch: Partial<ToolOptions>): void;
  select(ids: string[]): void;
  setActiveLayer(id: string): void;
  setView(view: Partial<View>): void;
  toggleGrid(): void;
  toggleSnap(): void;
  setSideTab(tab: 'library' | 'layers'): void;
  applyModeDefaults(mode: Mode): void;
  setEditingText(id: string | null): void;
  setPlayhead(t: Ticks): void;
  setPlaying(playing: boolean): void;
  setPreview(preview: boolean): void;
  toggleAutoKey(): void;
  toggleOnion(): void;
  setTimelineZoom(z: number): void;
  setTimelineHeight(h: number): void;
  setScene(sceneId: string, layerId: string): void;
  reset(sceneId: string, layerId: string, mode: Mode): void;
}

export const TIMELINE_MIN_H = 110;
const TIMELINE_H_KEY = 'dw.timeline.height';

function readTimelineHeight(): number | null {
  try {
    const v = Number(localStorage.getItem(TIMELINE_H_KEY));
    return Number.isFinite(v) && v >= TIMELINE_MIN_H ? v : null;
  } catch {
    return null;
  }
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
  snap: true,
  sideTab: 'library',
  editingTextId: null,
  playhead: 0,
  playing: false,
  preview: false,
  autoKey: false,
  onion: true,
  timelineZoom: 80,
  timelineHeight: readTimelineHeight(),

  setTool: (tool) => set((s) => ({ tool, selection: tool === 'select' ? s.selection : [], editingTextId: null })),
  setOptions: (patch) => set((s) => ({ options: { ...s.options, ...patch } })),
  select: (ids) => set({ selection: ids }),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setView: (view) => set((s) => ({ view: { ...s.view, ...view } })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setSideTab: (sideTab) => set({ sideTab }),
  applyModeDefaults: (mode) => set({ snap: mode !== 'free', sideTab: mode === 'free' ? 'layers' : 'library' }),
  setEditingText: (id) => set({ editingTextId: id }),
  setPlayhead: (t) => set({ playhead: Math.max(0, Math.round(t)) }),
  setPlaying: (playing) => set((s) => ({ playing, preview: playing ? true : s.preview })),
  setPreview: (preview) => set((s) => ({ preview, playing: preview ? s.playing : false })),
  toggleAutoKey: () => set((s) => ({ autoKey: !s.autoKey })),
  toggleOnion: () => set((s) => ({ onion: !s.onion })),
  setTimelineZoom: (z) => set({ timelineZoom: Math.min(800, Math.max(10, z)) }),
  setTimelineHeight: (h) => {
    const v = Math.round(Math.max(TIMELINE_MIN_H, h));
    try {
      localStorage.setItem(TIMELINE_H_KEY, String(v));
    } catch {
      /* sin almacenamiento: solo en esta sesión */
    }
    set({ timelineHeight: v });
  },
  setScene: (sceneId, layerId) =>
    set({ sceneId, activeLayerId: layerId, selection: [], playhead: 0, editingTextId: null }),
  reset: (sceneId, layerId, mode) =>
    set({
      sceneId,
      activeLayerId: layerId,
      selection: [],
      editingTextId: null,
      tool: mode === 'guided' ? 'select' : 'pencil',
      view: { zoom: 1, panX: 0, panY: 0, fit: true },
      snap: mode !== 'free',
      sideTab: mode === 'free' ? 'layers' : 'library',
      playhead: 0,
      playing: false,
      preview: false,
    }),
}));

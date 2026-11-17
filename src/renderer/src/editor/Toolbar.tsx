import {
  ArrowUpRight,
  Circle,
  Eraser,
  Hand,
  Video,
  MousePointer2,
  Pencil,
  Slash,
  Square,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { useEditor, type Tool } from './editor-store';

export const TOOLS: { id: Tool; label: string; key: string; icon: LucideIcon }[] = [
  { id: 'select', label: 'Seleccionar', key: 'V', icon: MousePointer2 },
  { id: 'pencil', label: 'Lápiz', key: 'B', icon: Pencil },
  { id: 'eraser', label: 'Goma', key: 'E', icon: Eraser },
  { id: 'rect', label: 'Rectángulo', key: 'R', icon: Square },
  { id: 'ellipse', label: 'Elipse', key: 'O', icon: Circle },
  { id: 'line', label: 'Línea', key: 'L', icon: Slash },
  { id: 'arrow', label: 'Flecha', key: 'A', icon: ArrowUpRight },
  { id: 'text', label: 'Texto', key: 'T', icon: Type },
  { id: 'hand', label: 'Mano (o mantén Espacio)', key: 'H', icon: Hand },
  { id: 'camera', label: 'Encuadre de cámara', key: 'C', icon: Video },
];

export function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  return (
    <nav className="toolbar" aria-label="Herramientas">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`tool-btn ${tool === t.id ? 'is-active' : ''}`}
          aria-pressed={tool === t.id}
          aria-label={t.label}
          title={`${t.label} (${t.key})`}
          onClick={() => setTool(t.id)}
        >
          <t.icon size={20} />
        </button>
      ))}
    </nav>
  );
}

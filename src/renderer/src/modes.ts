import { Brush, Layers, Sparkles, type LucideIcon } from 'lucide-react';
import type { Mode } from '@core/model/types';

export const MODES: { id: Mode; label: string; description: string; icon: LucideIcon }[] = [
  {
    id: 'guided',
    label: 'Guiado',
    description: 'Personajes, objetos y ayudas para crear sin saber dibujar.',
    icon: Sparkles,
  },
  { id: 'mixed', label: 'Mixto', description: 'Combina la biblioteca con tus propios dibujos.', icon: Layers },
  { id: 'free', label: 'Libre', description: 'Lienzo limpio y todas las herramientas, sin ayudas.', icon: Brush },
];

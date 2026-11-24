// Animaciones rápidas de un clic y suavizado del movimiento del elemento seleccionado.
import { useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsUp,
  Cloud,
  Expand,
  Heart,
  LogIn,
  LogOut,
  RotateCw,
  Vibrate,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { EASE_LABELS, itemEase, PRESET_LABELS, type Direction, type PresetId } from '@core/anim/presets';
import type { Ease, Item } from '@core/model/types';
import { applyPresetToSelection, setSelectionEase } from './actions';

export const PRESETS: { id: PresetId; icon: LucideIcon }[] = [
  { id: 'enter', icon: LogIn },
  { id: 'exit', icon: LogOut },
  { id: 'jump', icon: ChevronsUp },
  { id: 'sway', icon: Waves },
  { id: 'pulse', icon: Heart },
  { id: 'float', icon: Cloud },
  { id: 'spin', icon: RotateCw },
  { id: 'shake', icon: Vibrate },
  { id: 'grow', icon: Expand },
];

export const DIRECTIONS: { id: Direction; label: string; icon: LucideIcon }[] = [
  { id: 'left', label: 'Izquierda', icon: ArrowLeft },
  { id: 'right', label: 'Derecha', icon: ArrowRight },
  { id: 'up', label: 'Arriba', icon: ArrowUp },
  { id: 'down', label: 'Abajo', icon: ArrowDown },
];

export function QuickAnimations({ items, hasKeys }: { items: Item[]; hasKeys: boolean }) {
  const [direction, setDirection] = useState<Direction>('left');
  const ease = items.length ? itemEase(items[0]!) : null;
  return (
    <div className="quick-anims" role="group" aria-label="Animaciones rápidas">
      <h3 className="panel-subtitle">Animaciones rápidas</h3>
      <div className="quick-dir">
        <span className="control-label">Lado para entrar o salir</span>
        <ToggleGroup.Root
          type="single"
          className="quick-dir-group"
          aria-label="Lado para entrar o salir"
          value={direction}
          onValueChange={(v) => v && setDirection(v as Direction)}
        >
          {DIRECTIONS.map((d) => (
            <ToggleGroup.Item
              key={d.id}
              value={d.id}
              className="icon-btn icon-btn-sm"
              aria-label={d.label}
              title={d.label}
            >
              <d.icon size={14} />
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>
      <div className="quick-grid">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="quick-btn"
            title={`${PRESET_LABELS[p.id]} desde el cabezal`}
            onClick={() => applyPresetToSelection(p.id, direction)}
          >
            <p.icon size={16} aria-hidden />
            {PRESET_LABELS[p.id]}
          </button>
        ))}
      </div>
      {hasKeys && (
        <label className="inline-field">
          <span className="control-label">Suavizado</span>
          <select
            className="input input-sm"
            aria-label="Suavizado del movimiento"
            value={ease ?? ''}
            onChange={(e) => e.target.value && setSelectionEase(e.target.value as Ease)}
          >
            {ease === null && <option value="">Varios</option>}
            {(Object.keys(EASE_LABELS) as Ease[]).map((k) => (
              <option key={k} value={k}>
                {EASE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="hint">Se añaden en el cabezal como keyframes: puedes moverlos en la línea de tiempo.</p>
    </div>
  );
}

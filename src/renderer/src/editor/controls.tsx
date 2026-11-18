// Controles reutilizables: paleta de color y deslizador con valor.
import * as Slider from '@radix-ui/react-slider';
import { Ban } from 'lucide-react';
import { PALETTE } from './editor-store';

export function ColorPicker({
  label,
  value,
  onChange,
  allowNone = false,
  colors = PALETTE,
}: {
  label: string;
  value: string | null;
  onChange: (c: string | null) => void;
  allowNone?: boolean;
  colors?: readonly string[];
}) {
  return (
    <div className="color-picker" role="group" aria-label={label}>
      <span className="control-label">{label}</span>
      {allowNone && (
        <button
          className={`swatch swatch-none ${value === null ? 'is-active' : ''}`}
          aria-label="Sin color"
          aria-pressed={value === null}
          title="Sin color"
          onClick={() => onChange(null)}
        >
          <Ban size={14} />
        </button>
      )}
      {colors.map((c) => (
        <button
          key={c}
          className={`swatch ${value?.toLowerCase() === c ? 'is-active' : ''}`}
          style={{ background: c }}
          aria-label={`Color ${c}`}
          aria-pressed={value?.toLowerCase() === c}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="swatch swatch-custom" title="Otro color">
        <input
          type="color"
          aria-label={`${label}: otro color`}
          value={value ?? '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

export function ValueSlider({
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(v),
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
}) {
  return (
    <div className="value-slider">
      <span className="control-label">{label}</span>
      <Slider.Root
        className="slider"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v!)}
        onValueCommit={([v]) => onCommit?.(v!)}
        aria-label={label}
      >
        <Slider.Track className="slider-track">
          <Slider.Range className="slider-range" />
        </Slider.Track>
        <Slider.Thumb className="slider-thumb" aria-label={label} />
      </Slider.Root>
      <span className="control-value">{format(value)}</span>
    </div>
  );
}

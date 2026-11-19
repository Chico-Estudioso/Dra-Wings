// Controles reutilizables: paleta de color y deslizador con valor.
import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Slider from '@radix-ui/react-slider';
import { Ban } from 'lucide-react';
import { PALETTE } from './editor-store';
import { rememberColorSoon, useRecentColors } from './recent-colors';

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
  const recent = useRecentColors((s) => s.colors).filter((c) => !colors.includes(c));
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
      {recent.map((c) => (
        <button
          key={`recent-${c}`}
          className={`swatch swatch-recent ${value?.toLowerCase() === c ? 'is-active' : ''}`}
          style={{ background: c }}
          aria-label={`Color reciente ${c}`}
          aria-pressed={value?.toLowerCase() === c}
          title="Usado hace poco"
          onClick={() => onChange(c)}
        />
      ))}
      <label className="swatch swatch-custom" title="Otro color">
        <input
          type="color"
          aria-label={`${label}: otro color`}
          value={value ?? '#000000'}
          onChange={(e) => {
            onChange(e.target.value);
            if (!colors.includes(e.target.value.toLowerCase())) rememberColorSoon(e.target.value);
          }}
        />
      </label>
    </div>
  );
}

type ColorPickerProps = Parameters<typeof ColorPicker>[0];

/** Botón con el color actual que abre la paleta (para barras con poco sitio). */
export function ColorButton(props: ColorPickerProps) {
  const { label, value } = props;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="color-button" aria-label={`${label}: ${value ?? 'sin color'}`} title={`${label}: elegir`}>
          <span className="control-label">{label}</span>
          <span className="swatch" style={{ background: value ?? 'transparent' }} aria-hidden>
            {value === null && <Ban size={14} />}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="menu-popover color-popover" sideOffset={4} align="start">
          <ColorPicker {...props} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Ventanas con sitio para la paleta completa en la barra de opciones. */
const WIDE = '(min-width: 1440px)';

function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(WIDE).matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/**
 * Color en la barra de opciones: la paleta a la vista si hay sitio y, en ventanas estrechas, un
 * botón con el color actual que la abre.
 */
export function ToolColor(props: ColorPickerProps) {
  return useWide() ? <ColorPicker {...props} /> : <ColorButton {...props} />;
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

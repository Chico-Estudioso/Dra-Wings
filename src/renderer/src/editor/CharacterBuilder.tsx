import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  buildCharacter,
  CLOTHES_COLORS,
  DEFAULT_CHARACTER,
  EXPRESSIONS,
  HAIR_COLORS,
  HAIR_STYLES,
  POSES,
  SKIN_TONES,
  type CharacterOptions,
} from '@core/library/character';
import { placeGroup } from '@core/library/place';
import type { Project } from '@core/model/types';
import { insertItems } from './actions';
import { renderItemsTo } from './thumbnails';

function Options<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<K, string>;
  value: K;
  onChange: (v: K) => void;
}) {
  return (
    <fieldset className="field">
      <legend className="field-label">{label}</legend>
      <div className="chips" role="radiogroup" aria-label={label}>
        {(Object.keys(options) as K[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            className={`chip ${value === k ? 'is-active' : ''}`}
            onClick={() => onChange(k)}
          >
            {options[k]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Swatches({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="color-picker" role="radiogroup" aria-label={label}>
      <span className="control-label">{label}</span>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`${label} ${c}`}
          className={`swatch ${value === c ? 'is-active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export function CharacterBuilder({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const [o, setO] = useState<CharacterOptions>(DEFAULT_CHARACTER);
  const preview = useRef<HTMLCanvasElement>(null);
  const set = (patch: Partial<CharacterOptions>) => setO((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (open && preview.current) renderItemsTo(preview.current, [buildCharacter(o)], 0.06);
  }, [o, open]);

  const insert = () => {
    const { width, height } = project.settings;
    const g = placeGroup(buildCharacter(o), { cx: width / 2, cy: height / 2, height: height * 0.55 });
    insertItems([g], 'Añadir personaje');
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog dialog-wide" aria-describedby={undefined}>
          <Dialog.Title className="dialog-title">Crear personaje</Dialog.Title>
          <div className="builder">
            <canvas
              ref={preview}
              width={260}
              height={420}
              className="builder-preview"
              aria-label="Vista previa del personaje"
            />
            <div className="form builder-options">
              <Options label="Pelo" options={HAIR_STYLES} value={o.hair} onChange={(hair) => set({ hair })} />
              <Options
                label="Expresión"
                options={EXPRESSIONS}
                value={o.expression}
                onChange={(expression) => set({ expression })}
              />
              <Options label="Postura" options={POSES} value={o.pose} onChange={(pose) => set({ pose })} />
              <Swatches label="Piel" colors={SKIN_TONES} value={o.skin} onChange={(skin) => set({ skin })} />
              <Swatches
                label={o.hair === 'gorra' ? 'Gorra' : 'Pelo'}
                colors={o.hair === 'gorra' ? CLOTHES_COLORS : HAIR_COLORS}
                value={o.hairColor}
                onChange={(hairColor) => set({ hairColor })}
              />
              <Swatches label="Camiseta" colors={CLOTHES_COLORS} value={o.shirt} onChange={(shirt) => set({ shirt })} />
              <Swatches label="Pantalón" colors={CLOTHES_COLORS} value={o.pants} onChange={(pants) => set({ pants })} />
            </div>
          </div>
          <div className="dialog-actions">
            <Dialog.Close className="btn btn-ghost">Cancelar</Dialog.Close>
            <button className="btn btn-primary" onClick={insert}>
              Añadir al lienzo
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

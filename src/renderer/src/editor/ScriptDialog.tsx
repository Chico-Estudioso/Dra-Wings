// Diálogo «Crear escenas desde un guion»: pegar un guion o una letra y crear sus escenas.
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { splitScript, type ScriptSplit } from '@core/edit/script';
import { REVEAL_LABELS, type TextReveal } from '@core/render/text-reveal';
import { createScenesFromScript } from './script-actions';

const PLACEHOLDER = `Había una vez una niña que soñaba con volar.

Un día encontró unas alas de papel.

Y salió por la ventana…`;

export function ScriptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [text, setText] = useState('');
  const [split, setSplit] = useState<ScriptSplit>('paragraph');
  const [reveal, setReveal] = useState<TextReveal>('words');
  const blocks = splitScript(text, split);
  const create = async () => {
    await createScenesFromScript(blocks, reveal);
    setText('');
    onOpenChange(false);
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog dialog-wide" aria-describedby="script-desc">
          <Dialog.Title className="dialog-title">Crear escenas desde un guion</Dialog.Title>
          <p id="script-desc" className="hint">
            Pega el guion de tu historia o la letra de una canción. Cada bloque será una escena con el texto
            escribiéndose solo; después puedes añadir dibujos, personajes y música.
          </p>
          <div className="form">
            <textarea
              className="input script-text"
              aria-label="Guion"
              placeholder={PLACEHOLDER}
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <fieldset className="field">
              <legend className="field-label">Una escena por</legend>
              <div className="chips" role="radiogroup" aria-label="Una escena por">
                {(
                  [
                    ['paragraph', 'Párrafo'],
                    ['line', 'Línea'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={split === k}
                    className={`chip ${split === k ? 'is-active' : ''}`}
                    onClick={() => setSplit(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="inline-field">
              <span className="control-label">Escritura</span>
              <select
                className="input input-sm"
                aria-label="Escritura de los textos"
                value={reveal}
                onChange={(e) => setReveal(e.target.value as TextReveal)}
              >
                {(Object.keys(REVEAL_LABELS) as TextReveal[]).map((r) => (
                  <option key={r} value={r}>
                    {REVEAL_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="dialog-actions">
            <span className="hint script-count" aria-live="polite">
              {blocks.length === 0
                ? 'Escribe o pega el texto.'
                : `Se ${blocks.length === 1 ? 'creará 1 escena' : `crearán ${blocks.length} escenas`}.`}
            </span>
            <Dialog.Close className="btn btn-ghost">Cancelar</Dialog.Close>
            <button className="btn btn-primary" disabled={!blocks.length} onClick={() => void create()}>
              Crear escenas
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

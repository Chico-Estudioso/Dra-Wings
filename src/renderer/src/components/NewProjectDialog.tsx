import { useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { ASPECT_PRESETS, type AspectPreset } from '@core/model/factory';
import type { Mode } from '@core/model/types';
import type { Fps } from '@core/time/ticks';
import { useApp } from '../state/app-store';
import { newProject } from '../state/doc-actions';
import { MODES } from '../modes';

const FPS_OPTIONS: Fps[] = [24, 25, 30, 60];

function AspectIcon({ aspect }: { aspect: AspectPreset }) {
  const { width, height } = ASPECT_PRESETS[aspect];
  const scale = 28 / Math.max(width, height);
  return (
    <span className="aspect-icon" aria-hidden>
      <span style={{ width: width * scale, height: height * scale }} />
    </span>
  );
}

export function NewProjectDialog() {
  const open = useApp((s) => s.newProjectOpen);
  const setOpen = useApp((s) => s.setNewProjectOpen);
  const [name, setName] = useState('Mi historia');
  const [aspect, setAspect] = useState<AspectPreset>('landscape');
  const [fps, setFps] = useState<Fps>(30);
  const [mode, setMode] = useState<Mode>('guided');

  const valid = name.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    newProject({ name, aspect, fps, mode });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <Dialog.Title className="dialog-title">Nuevo proyecto</Dialog.Title>
          <form onSubmit={submit} className="form">
            <label className="field">
              <span className="field-label">Nombre</span>
              <input
                className="input"
                value={name}
                maxLength={200}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!valid}
              />
            </label>

            <fieldset className="field">
              <legend className="field-label">Formato</legend>
              <RadioGroup.Root
                className="choice-row"
                value={aspect}
                onValueChange={(v) => setAspect(v as AspectPreset)}
                aria-label="Formato"
              >
                {(Object.keys(ASPECT_PRESETS) as AspectPreset[]).map((key) => (
                  <RadioGroup.Item key={key} value={key} className="choice">
                    <AspectIcon aspect={key} />
                    <span className="choice-title">{ASPECT_PRESETS[key].label}</span>
                    <span className="choice-sub">
                      {ASPECT_PRESETS[key].width} × {ASPECT_PRESETS[key].height}
                    </span>
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            </fieldset>

            <label className="field">
              <span className="field-label">Fotogramas por segundo</span>
              <select className="input" value={fps} onChange={(e) => setFps(Number(e.target.value) as Fps)}>
                {FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f} fps{f === 30 ? ' (recomendado)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="field">
              <legend className="field-label">¿Cómo quieres empezar?</legend>
              <RadioGroup.Root
                className="choice-col"
                value={mode}
                onValueChange={(v) => setMode(v as Mode)}
                aria-label="Modo"
              >
                {MODES.map((m) => (
                  <RadioGroup.Item key={m.id} value={m.id} className="choice choice-wide">
                    <m.icon size={20} aria-hidden />
                    <span>
                      <span className="choice-title">{m.label}</span>
                      <span className="choice-sub">{m.description}</span>
                    </span>
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
              <p className="hint">Puedes cambiar de modo en cualquier momento sin perder nada.</p>
            </fieldset>

            <div className="dialog-actions">
              <Dialog.Close type="button" className="btn btn-ghost">
                Cancelar
              </Dialog.Close>
              <button type="submit" className="btn btn-primary" disabled={!valid}>
                Crear proyecto
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

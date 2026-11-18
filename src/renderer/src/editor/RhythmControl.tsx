// Herramientas para sincronizar con el ritmo de la música (o con un pulso de 120 BPM sin música).
import * as Popover from '@radix-ui/react-popover';
import { Drum } from 'lucide-react';
import { hasBeats } from '@core/audio/rhythm';
import type { Project, Scene } from '@core/model/types';
import { alignSceneToBars, appearOnBeats, setBeatPulse } from './actions';
import { useEditor } from './editor-store';

export function RhythmControl({ project, scene }: { project: Project; scene: Scene }) {
  const selected = useEditor((s) => s.selection.length);
  const music = hasBeats(project);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`icon-btn icon-btn-sm ${scene.beatPulse ? 'is-on' : ''}`}
          aria-label="Ritmo"
          title="Sincronizar con el ritmo de la música"
        >
          <Drum size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="menu-popover boil-popover" sideOffset={4} align="end" aria-label="Ritmo">
          <span className="menu-label">Aparecer al ritmo (desde el cabezal)</span>
          <Popover.Close asChild>
            <button className="menu-item" disabled={!selected} onClick={() => appearOnBeats(false)}>
              Uno en cada golpe
            </button>
          </Popover.Close>
          <Popover.Close asChild>
            <button className="menu-item" disabled={!selected} onClick={() => appearOnBeats(true)}>
              Uno en cada compás
            </button>
          </Popover.Close>
          {!selected && <p className="hint boil-hint">Selecciona los elementos que quieras que aparezcan.</p>}
          <span className="menu-label">Escena</span>
          <Popover.Close asChild>
            <button className="menu-item" onClick={alignSceneToBars}>
              Ajustar el final al compás
            </button>
          </Popover.Close>
          <label className="menu-item">
            <input type="checkbox" checked={!!scene.beatPulse} onChange={(e) => setBeatPulse(e.target.checked)} />
            Cámara que late con el compás
          </label>
          <p className="hint boil-hint">
            {music
              ? 'Sigue los golpes detectados en la música.'
              : 'Sin música con ritmo detectado se usa un pulso de 120 BPM. Importa una canción en la pista de música.'}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

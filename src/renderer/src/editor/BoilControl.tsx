// «Trazo vivo»: elegir cuánto tiemblan las líneas del proyecto al reproducir y en el vídeo.
import * as Popover from '@radix-ui/react-popover';
import { Activity } from 'lucide-react';
import { BOIL_LABELS, type BoilLevel } from '@core/render/boil';
import type { Project } from '@core/model/types';
import { setBoil, setHand, setPaper } from './actions';
import { PAPER_LABELS, type PaperStyle } from '@core/render/paper';
import { HAND_LABELS, type HandStyle } from '@core/render/hand';

const LEVELS = Object.keys(BOIL_LABELS) as BoilLevel[];
const HANDS = Object.keys(HAND_LABELS) as HandStyle[];

export function BoilControl({ project }: { project: Project }) {
  const level = project.settings.boil ?? 'off';
  const hand = project.settings.hand ?? 'none';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`icon-btn icon-btn-sm ${level !== 'off' ? 'is-on' : ''}`}
          aria-label={`Trazo vivo: ${BOIL_LABELS[level]}`}
          title={`Trazo vivo: ${BOIL_LABELS[level]}. Las líneas tiemblan un poco, como en la animación dibujada a mano`}
        >
          <Activity size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="menu-popover boil-popover" sideOffset={4} align="end" aria-label="Trazo vivo">
          <span className="menu-label">Trazo vivo</span>
          <div role="radiogroup" aria-label="Intensidad del trazo vivo" className="boil-options">
            {LEVELS.map((l) => (
              <label key={l} className="menu-item">
                <input type="radio" name="boil" checked={level === l} onChange={() => setBoil(l)} />
                {BOIL_LABELS[l]}
              </label>
            ))}
          </div>
          <p className="hint boil-hint">
            Las líneas tiemblan un poco todo el rato, como en la animación dibujada a mano. Se ve al reproducir, en la
            vista previa y en el vídeo; al editar el dibujo se queda quieto.
          </p>
          <span className="menu-label">Mano que dibuja</span>
          <div role="radiogroup" aria-label="Mano que dibuja" className="boil-options">
            {HANDS.map((h) => (
              <label key={h} className="menu-item">
                <input type="radio" name="hand" checked={hand === h} onChange={() => setHand(h)} />
                {HAND_LABELS[h]}
              </label>
            ))}
          </div>
          <p className="hint boil-hint">
            Una mano sigue la punta de lo que se va dibujando, como en los vídeos de pizarra.
          </p>
          <label className="inline-field boil-paper">
            <span className="control-label">Hoja</span>
            <select
              className="input input-sm"
              aria-label="Tipo de hoja"
              value={project.settings.paper ?? 'plain'}
              onChange={(e) => setPaper(e.target.value as PaperStyle)}
            >
              {(Object.keys(PAPER_LABELS) as PaperStyle[]).map((k) => (
                <option key={k} value={k}>
                  {PAPER_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

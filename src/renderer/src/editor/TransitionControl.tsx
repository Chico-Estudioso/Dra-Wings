// Transición con la que entra la escena actual desde la anterior.
import * as Popover from '@radix-ui/react-popover';
import { Blend } from 'lucide-react';
import { TRANSITION_LABELS, type TransitionKind } from '@core/render/transition';
import type { Scene } from '@core/model/types';
import { ticksFromSeconds } from '@core/time/ticks';
import { updateCurrentScene } from './actions';

const KINDS = Object.keys(TRANSITION_LABELS) as TransitionKind[];
const SPEEDS = [
  { label: 'Rápida', seconds: 0.4 },
  { label: 'Normal', seconds: 0.8 },
  { label: 'Lenta', seconds: 1.5 },
];

function setTransition(kind: TransitionKind, seconds: number) {
  updateCurrentScene('Transición', (scene) => {
    scene.transition = kind === 'cut' ? undefined : { kind, duration: ticksFromSeconds(seconds) };
  });
}

export function TransitionControl({ scene }: { scene: Scene }) {
  const kind = scene.transition?.kind ?? 'cut';
  const seconds = scene.transition ? scene.transition.duration / ticksFromSeconds(1) : 0.8;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`icon-btn icon-btn-sm ${kind !== 'cut' ? 'is-on' : ''}`}
          aria-label={`Transición de entrada: ${TRANSITION_LABELS[kind]}`}
          title={`Cómo entra esta escena desde la anterior: ${TRANSITION_LABELS[kind]}`}
        >
          <Blend size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="menu-popover boil-popover" sideOffset={4} align="end" aria-label="Transición">
          <span className="menu-label">Entrada de la escena</span>
          <div role="radiogroup" aria-label="Tipo de transición" className="boil-options">
            {KINDS.map((k) => (
              <label key={k} className="menu-item">
                <input type="radio" name="transition" checked={kind === k} onChange={() => setTransition(k, seconds)} />
                {TRANSITION_LABELS[k]}
              </label>
            ))}
          </div>
          {kind !== 'cut' && (
            <>
              <span className="menu-label">Velocidad</span>
              <div role="radiogroup" aria-label="Velocidad de la transición" className="assist-levels">
                {SPEEDS.map((s) => (
                  <label key={s.label} className={`chip ${Math.abs(seconds - s.seconds) < 0.01 ? 'is-active' : ''}`}>
                    <input
                      type="radio"
                      className="sr-only"
                      name="transition-speed"
                      checked={Math.abs(seconds - s.seconds) < 0.01}
                      onChange={() => setTransition(kind, s.seconds)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </>
          )}
          <p className="hint boil-hint">
            Ocupa el principio de esta escena; mientras dura se ve el final de la anterior.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

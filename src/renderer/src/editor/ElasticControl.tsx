// Elasticidad del proyecto: cuánto se estira lo que se mueve deprisa (como en los dibujos animados).
import * as Popover from '@radix-ui/react-popover';
import { Spline } from 'lucide-react';
import { ELASTIC_LABELS, type ElasticLevel } from '@core/anim/elastic';
import type { Project } from '@core/model/types';
import { setElastic } from './actions';

const LEVELS = Object.keys(ELASTIC_LABELS) as ElasticLevel[];

export function ElasticControl({ project }: { project: Project }) {
  const level = project.settings.elastic ?? 'off';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`icon-btn icon-btn-sm ${level !== 'off' ? 'is-on' : ''}`}
          aria-label={`Elasticidad: ${ELASTIC_LABELS[level]}`}
          title={`Elasticidad: ${ELASTIC_LABELS[level]}. Lo que se mueve deprisa se estira, como en los dibujos animados`}
        >
          <Spline size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="menu-popover boil-popover" sideOffset={4} align="end" aria-label="Elasticidad">
          <span className="menu-label">Elasticidad</span>
          <div role="radiogroup" aria-label="Intensidad de la elasticidad" className="boil-options">
            {LEVELS.map((l) => (
              <label key={l} className="menu-item">
                <input type="radio" name="elastic" checked={level === l} onChange={() => setElastic(l)} />
                {ELASTIC_LABELS[l]}
              </label>
            ))}
          </div>
          <p className="hint boil-hint">
            Lo que se mueve deprisa se estira en la dirección del movimiento y recupera su forma al frenar. Se ve al
            reproducir y en el vídeo.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

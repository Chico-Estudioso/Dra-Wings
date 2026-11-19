// Color de fondo de la escena actual (o de todas).
import * as Popover from '@radix-ui/react-popover';
import { PaintRoller } from 'lucide-react';
import type { Project, Scene } from '@core/model/types';
import { sceneBackground, sceneGradient } from '@core/render/frame';
import { useApp } from '../state/app-store';
import { updateCurrentScene } from './actions';
import { ColorPicker } from './controls';

/** Fondos claros y suaves (las líneas oscuras se leen bien) y dos oscuros. */
export const BACKGROUNDS = [
  '#ffffff',
  '#fbf6ea',
  '#fff3b0',
  '#fde2e4',
  '#e3f2d9',
  '#d9ecf7',
  '#e9e1f7',
  '#2b2d42',
  '#1d1d1f',
] as const;

function setSceneBackground(color: string | null) {
  updateCurrentScene('Color de fondo', (scene) => {
    if (color) scene.background = color;
    else delete scene.background;
  });
}

function setGradient(color: string | null, projectHasOne: boolean) {
  updateCurrentScene('Degradado del fondo', (scene) => {
    if (color) scene.gradient = color;
    // Sin degradado: liso aunque el proyecto lo tenga.
    else if (projectHasOne) scene.gradient = null;
    else delete scene.gradient;
  });
}

/** El fondo de esta escena (con su degradado) pasa a ser el de todas, también las nuevas. */
function applyToAll(color: string, gradient: string | null) {
  useApp.getState().apply('Fondo para todas las escenas', (p) => {
    p.settings.background = color;
    if (gradient) p.settings.gradient = gradient;
    else delete p.settings.gradient;
    for (const s of p.scenes) {
      delete s.background;
      delete s.gradient;
    }
  });
}

export function BackgroundControl({ project, scene }: { project: Project; scene: Scene }) {
  const color = sceneBackground(project.settings, scene);
  const gradient = sceneGradient(project.settings, scene);
  const projectGradient = !!project.settings.gradient;
  const own = scene.background !== undefined || scene.gradient !== undefined;
  const mixed = project.scenes.some((s) => s.background !== undefined || s.gradient !== undefined);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`icon-btn icon-btn-sm ${own ? 'is-on' : ''}`}
          aria-label="Fondo de la escena"
          title="Color de fondo de esta escena"
        >
          <PaintRoller size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="menu-popover bg-popover" sideOffset={4} align="end" aria-label="Fondo">
          <span className="menu-label">Fondo de esta escena</span>
          <ColorPicker
            label={gradient ? 'Arriba' : 'Fondo'}
            value={color}
            colors={BACKGROUNDS}
            onChange={(c) => c && setSceneBackground(c)}
          />
          <label className="check-field">
            <input
              type="checkbox"
              checked={!!gradient}
              onChange={(e) =>
                setGradient(e.target.checked ? (color === '#d9ecf7' ? '#fff3b0' : '#d9ecf7') : null, projectGradient)
              }
            />
            Degradado
          </label>
          {gradient && (
            <ColorPicker
              label="Abajo"
              value={gradient}
              colors={BACKGROUNDS}
              onChange={(c) => c && setGradient(c, projectGradient)}
            />
          )}
          <div className="bg-actions">
            {own && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  updateCurrentScene('Fondo como el resto del vídeo', (s) => {
                    delete s.background;
                    delete s.gradient;
                  })
                }
              >
                Como el resto del vídeo
              </button>
            )}
            {(own || mixed) && (
              <button
                className="btn btn-ghost btn-sm"
                title="Este color pasa a ser el fondo de todas las escenas"
                onClick={() => applyToAll(color, gradient)}
              >
                Usar en todas las escenas
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

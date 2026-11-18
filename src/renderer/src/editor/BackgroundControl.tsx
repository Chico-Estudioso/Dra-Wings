// Color de fondo de la escena actual (o de todas).
import * as Popover from '@radix-ui/react-popover';
import { PaintRoller } from 'lucide-react';
import type { Project, Scene } from '@core/model/types';
import { sceneBackground } from '@core/render/frame';
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

/** El fondo de esta escena pasa a ser el del proyecto, y todas las escenas lo usan. */
function applyToAll(color: string) {
  useApp.getState().apply('Fondo para todas las escenas', (p) => {
    p.settings.background = color;
    for (const s of p.scenes) delete s.background;
  });
}

export function BackgroundControl({ project, scene }: { project: Project; scene: Scene }) {
  const color = sceneBackground(project.settings, scene);
  const own = scene.background !== undefined;
  const mixed = project.scenes.some((s) => s.background !== undefined);
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
          <ColorPicker label="Fondo" value={color} colors={BACKGROUNDS} onChange={(c) => c && setSceneBackground(c)} />
          <div className="bg-actions">
            {own && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSceneBackground(null)}>
                Como el resto del vídeo
              </button>
            )}
            {(own || mixed) && (
              <button
                className="btn btn-ghost btn-sm"
                title="Este color pasa a ser el fondo de todas las escenas"
                onClick={() => applyToAll(color)}
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

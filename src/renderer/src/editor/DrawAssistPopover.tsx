// Ayudas al dibujar con el lápiz: estabilizador, trazo de tinta y formas rápidas.
import * as Popover from '@radix-ui/react-popover';
import { Wand2 } from 'lucide-react';
import {
  MIRROR_LABELS,
  STABILIZER_LABELS,
  type DrawAssist,
  type MirrorMode,
  type StabilizerLevel,
} from '@core/draw/assist';
import { useEditor } from './editor-store';

const LEVELS = Object.keys(STABILIZER_LABELS) as StabilizerLevel[];
const MIRRORS = Object.keys(MIRROR_LABELS) as MirrorMode[];

export function DrawAssistPopover() {
  const assist = useEditor((s) => s.options.assist);
  const axisMoved = useEditor((s) => s.mirrorAxis !== null);
  const set = (patch: Partial<DrawAssist>) =>
    useEditor.getState().setOptions({ assist: { ...useEditor.getState().options.assist, ...patch } });
  const active = assist.stabilizer !== 'off' || assist.ink || assist.quickShapes || assist.mirror !== 'off';
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={`btn btn-ghost btn-sm ${active ? 'is-on' : ''}`}
          title="Estabilizador, trazo de tinta, formas rápidas y espejo"
        >
          <Wand2 size={14} aria-hidden /> Ayudas
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="menu-popover assist-popover"
          sideOffset={4}
          align="start"
          aria-label="Ayudas al dibujar"
        >
          <span className="menu-label">Estabilizador</span>
          <div role="radiogroup" aria-label="Estabilizador" className="assist-levels">
            {LEVELS.map((l) => (
              <label key={l} className={`chip ${assist.stabilizer === l ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  className="sr-only"
                  name="stabilizer"
                  checked={assist.stabilizer === l}
                  onChange={() => set({ stabilizer: l })}
                />
                {STABILIZER_LABELS[l]}
              </label>
            ))}
          </div>
          <p className="hint assist-hint">Suaviza el pulso: el trazo sigue al puntero con un poco de retraso.</p>
          <label className="menu-item">
            <input type="checkbox" checked={assist.ink} onChange={(e) => set({ ink: e.target.checked })} />
            Trazo de tinta
          </label>
          <p className="hint assist-hint">Más fino deprisa, más grueso despacio y con las puntas afinadas.</p>
          <label className="menu-item">
            <input
              type="checkbox"
              checked={assist.quickShapes}
              onChange={(e) => set({ quickShapes: e.target.checked })}
            />
            Formas rápidas
          </label>
          <p className="hint assist-hint">
            Dibuja un círculo, una línea, un rectángulo o un triángulo y mantén el puntero quieto al final: se vuelve
            una forma limpia. Muévelo para seguir a mano alzada.
          </p>
          <span className="menu-label">Espejo</span>
          <div role="radiogroup" aria-label="Espejo" className="assist-levels">
            {MIRRORS.map((m) => (
              <label key={m} className={`chip ${assist.mirror === m ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  className="sr-only"
                  name="mirror"
                  checked={assist.mirror === m}
                  onChange={() => set({ mirror: m })}
                />
                {MIRROR_LABELS[m]}
              </label>
            ))}
          </div>
          <p className="hint assist-hint">
            Lo que dibujas se repite reflejado (caras, mariposas, edificios…). En el vídeo se dibujan a la vez. Arrastra
            el punto del eje en el lienzo para moverlo.
          </p>
          {axisMoved && assist.mirror !== 'off' && (
            <button className="btn btn-ghost btn-sm" onClick={() => useEditor.getState().setMirrorAxis(null)}>
              Volver el eje al centro
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

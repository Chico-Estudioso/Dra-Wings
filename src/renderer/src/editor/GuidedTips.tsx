import { useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

const KEY = 'dw.tips.guided.hidden';

function hidden(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Ayuda breve del modo Guiado. Se puede ocultar y no vuelve a aparecer. */
export function GuidedTips() {
  const [dismissed, setDismissed] = useState(hidden);
  if (dismissed) return null;
  return (
    <aside className="tips" aria-label="Primeros pasos">
      <header className="tips-header">
        <Lightbulb size={16} aria-hidden />
        <strong>Primeros pasos</strong>
        <button
          className="icon-btn icon-btn-sm"
          aria-label="Ocultar ayudas"
          title="Ocultar ayudas"
          onClick={() => {
            try {
              localStorage.setItem(KEY, '1');
            } catch {
              /* sin almacenamiento: se oculta solo en esta sesión */
            }
            setDismissed(true);
          }}
        >
          <X size={14} />
        </button>
      </header>
      <ol>
        <li>Elige una escena de partida o un personaje en la Biblioteca (o arrástralo al lienzo).</li>
        <li>Arrastra para moverlo; usa los tiradores para cambiar su tamaño o girarlo.</li>
        <li>Cambia sus colores en el panel de la derecha.</li>
        <li>Cuando quieras, dibuja tú con el lápiz (B).</li>
      </ol>
    </aside>
  );
}

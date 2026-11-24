// Borde izquierdo del panel lateral: se arrastra (o se usan las flechas) para cambiar su ancho.
import { useRef } from 'react';
import { SIDE_MAX_W, SIDE_MIN_W, useEditor } from './editor-store';

export function SideResizer() {
  const width = useEditor((s) => s.sideWidth);
  const start = useRef<{ x: number; w: number } | null>(null);
  const set = (w: number) => useEditor.getState().setSideWidth(Math.min(w, window.innerWidth * 0.45));
  return (
    <div
      className="side-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ancho del panel lateral"
      aria-valuemin={SIDE_MIN_W}
      aria-valuemax={SIDE_MAX_W}
      aria-valuenow={width}
      tabIndex={0}
      title="Arrastra o usa las flechas para cambiar el ancho del panel"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: useEditor.getState().sideWidth };
      }}
      // El panel está a la derecha: arrastrar hacia la izquierda lo ensancha.
      onPointerMove={(e) => start.current && set(start.current.w - (e.clientX - start.current.x))}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          set(width + (e.key === 'ArrowLeft' ? 20 : -20));
        }
      }}
    />
  );
}

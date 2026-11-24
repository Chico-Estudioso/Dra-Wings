// Tamaño de la ventana principal según el área útil de la pantalla (sin la barra de tareas). Puro, sin
// Electron, para poder probarlo.

export interface Size {
  width: number;
  height: number;
}

/** Tamaño cómodo si cabe. */
const PREFERRED: Size = { width: 1440, height: 900 };
/** Mínimo con el que la interfaz sigue siendo usable (nunca mayor que la pantalla). */
const MINIMUM: Size = { width: 800, height: 520 };
/** Por debajo de esto la ventana se abre maximizada. */
const SMALL: Size = { width: 1280, height: 760 };

export function windowSizeFor(area: Size): { size: Size; min: Size; maximize: boolean } {
  const size = {
    width: Math.min(PREFERRED.width, area.width),
    height: Math.min(PREFERRED.height, area.height),
  };
  const min = {
    width: Math.min(MINIMUM.width, area.width),
    height: Math.min(MINIMUM.height, area.height),
  };
  return { size, min, maximize: area.width < SMALL.width || area.height < SMALL.height };
}

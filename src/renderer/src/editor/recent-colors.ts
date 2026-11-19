// Colores recientes: los colores personalizados usados últimamente aparecen en todas las paletas. Se
// recuerdan en este equipo (preferencia de la interfaz, no del proyecto).
import { create } from 'zustand';

const KEY = 'dw.recentColors';
export const MAX_RECENT = 6;
/** Espera tras el último cambio antes de recordar el color (el selector cambia mientras se arrastra). */
const SETTLE_MS = 700;

function load(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v)
      ? v.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

export const useRecentColors = create<{ colors: string[] }>(() => ({ colors: load() }));

/** Pone el color el primero de la lista (sin repetir) y lo guarda. */
export function rememberColor(color: string): void {
  const c = color.toLowerCase();
  const colors = [c, ...useRecentColors.getState().colors.filter((x) => x !== c)].slice(0, MAX_RECENT);
  useRecentColors.setState({ colors });
  try {
    localStorage.setItem(KEY, JSON.stringify(colors));
  } catch {
    // Sin almacenamiento disponible: se recuerdan solo durante la sesión.
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Recuerda el color cuando se deja de mover el selector. */
export function rememberColorSoon(color: string): void {
  clearTimeout(timer);
  timer = setTimeout(() => rememberColor(color), SETTLE_MS);
}

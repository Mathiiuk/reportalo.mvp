/**
 * Preferencia de tema claro / oscuro (UJ v3.3 §10 «Comportamiento del tema» — H-09).
 *
 * Se guarda por dispositivo y arranca siempre en claro, sin heredar el tema del sistema
 * operativo (decisión de UX, Iván, 23/09/2026). El diseño prevé guardarla por cuenta, lo que
 * necesita un campo en el perfil: hasta que el PO lo defina, alcanza con el dispositivo y
 * migrar después no rompe nada.
 */

/**
 * El conmutador queda apagado mientras haya pantallas que no usan los tokens del Bloque 0:
 * se verían a medio pasar a oscuro. Para habilitarlo, poner esta constante en true.
 */
export const THEME_TOGGLE_ENABLED = false;

const THEME_KEY = 'reportalo_theme';

// El almacenamiento puede no existir o lanzar (modo privado, datos bloqueados): se trata como vacío
const safeStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** Tema guardado en el dispositivo. Cualquier valor que no sea 'dark' cuenta como claro. */
export const getStoredTheme = () => {
  try {
    return safeStorage()?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

/** Aplica el tema en <html>: Tailwind usa darkMode 'class'. */
export const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

/** Guarda y aplica el tema elegido por el ciudadano. Si no se puede guardar, igual se aplica. */
export const setThemePreference = (theme) => {
  const next = theme === 'dark' ? 'dark' : 'light';
  try {
    safeStorage()?.setItem(THEME_KEY, next);
  } catch {
    // Sin almacenamiento el tema dura hasta recargar, que es lo mismo que pasaba antes
  }
  applyTheme(next);
  return next;
};

/**
 * Se llama al arrancar, antes de pintar la app. Con el conmutador apagado siempre queda claro,
 * aunque haya quedado guardado un 'dark' de cuando estuvo encendido.
 */
export const initTheme = () => {
  applyTheme(THEME_TOGGLE_ENABLED ? getStoredTheme() : 'light');
};

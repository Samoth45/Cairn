import type { Theme } from '../types';

/** Thème effectivement affiché. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Copie du thème dans localStorage, lue par le script de `index.html` avant le premier rendu
 * (les paramètres IndexedDB arrivent trop tard : sinon flash du thème clair au chargement).
 * La source de vérité reste `Settings.theme`.
 */
export const THEME_STORAGE_KEY = 'cairn-theme';

/** Libellés du réglage (paramètres). */
export const THEME_LABELS: Record<Theme, string> = {
  system: 'Système (comme l’appareil)',
  light: 'Clair',
  dark: 'Sombre',
};

/** Thème affiché : le choix explicite, sinon celui du système. */
export function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
  if (theme === 'light' || theme === 'dark') return theme;
  return systemDark ? 'dark' : 'light';
}

/** Choix explicite enregistré au clic sur le bouton de bascule. */
export function toggledTheme(current: ResolvedTheme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}


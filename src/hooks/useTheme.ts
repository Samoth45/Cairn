import { useEffect, useSyncExternalStore } from 'react';
import type { Theme } from '../types';
import { resolveTheme, THEME_STORAGE_KEY, type ResolvedTheme } from '../lib/theme';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const systemDark = () => window.matchMedia(QUERY).matches;

/**
 * Thème affiché selon le réglage (« system » suit l'appareil, y compris s'il change en cours
 * d'utilisation) ; l'applique au document.
 */
export function useTheme(theme: Theme | undefined): ResolvedTheme {
  const dark = useSyncExternalStore(subscribe, systemDark);
  const resolved = resolveTheme(theme ?? 'system', dark);
  useEffect(() => {
    // Paramètres pas encore chargés : on garde le thème posé par index.html.
    if (!theme) return;
    document.documentElement.dataset.theme = resolved;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Stockage indisponible (navigation privée…) : seul le prochain chargement est concerné.
    }
  }, [theme, resolved]);
  return resolved;
}

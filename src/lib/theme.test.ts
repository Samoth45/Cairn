import { describe, expect, it } from 'vitest';
import { resolveTheme, toggledTheme } from './theme';
import { normalizeSettings } from './settings';

describe('thème clair / sombre', () => {
  it('suit le système tant qu’aucun choix n’est fait', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('un choix explicite l’emporte sur le système', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('la bascule enregistre le thème opposé à celui affiché', () => {
    expect(toggledTheme('light')).toBe('dark');
    expect(toggledTheme('dark')).toBe('light');
  });

  it('paramètres : « system » par défaut, valeur invalide ignorée', () => {
    expect(normalizeSettings({}).theme).toBe('system');
    expect(normalizeSettings({ theme: 'bleu' }).theme).toBe('system');
    expect(normalizeSettings({ theme: 'dark' }).theme).toBe('dark');
  });
});

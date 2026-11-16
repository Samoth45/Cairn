import { describe, expect, it } from 'vitest';
import { isKeyPoint } from './weatherPoints';
import { normalizeSettings } from './settings';

describe('panneau latéral à onglets', () => {
  it('points clés : ceux qui portent un rôle', () => {
    expect(isKeyPoint({ roles: ['summit'] })).toBe(true);
    expect(isKeyPoint({ roles: ['start', 'lowest'] })).toBe(true);
    expect(isKeyPoint({ roles: [] })).toBe(false);
  });

  it('onglet : « stats » par défaut, valeur invalide ignorée', () => {
    expect(normalizeSettings({}).sidePanelTab).toBe('stats');
    expect(normalizeSettings({ sidePanelTab: 'carte' }).sidePanelTab).toBe('stats');
    expect(normalizeSettings({ sidePanelTab: 'weather' }).sidePanelTab).toBe('weather');
  });
});

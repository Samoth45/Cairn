import { describe, expect, it } from 'vitest';
import { niceStep, ticks } from './ticks';
import { formatDuration, formatKm, formatMeters } from './format';
import { normalizeSettings } from './settings';
import { DEFAULT_SETTINGS } from '../types';

describe('graduations', () => {
  it('choisit des pas ronds', () => {
    expect(niceStep(1000, 5)).toBe(200);
    expect(niceStep(870, 4)).toBe(250);
    expect(niceStep(12000, 6)).toBe(2000);
  });
  it('liste les graduations dans l’intervalle', () => {
    expect(ticks(950, 1420, 100)).toEqual([1000, 1100, 1200, 1300, 1400]);
  });
});

describe('formatage', () => {
  it('formate en français', () => {
    expect(formatKm(12345)).toBe('12 km');
    expect(formatKm(5430)).toBe('5,4 km');
    expect(formatMeters(null)).toBe('–');
    expect(formatMeters(2352.4).replace(/\s/g, ' ')).toBe('2 352 m');
    expect(formatDuration(5.25)).toBe('5 h 15');
    expect(formatDuration(0.5)).toBe('30 min');
  });
});

describe('normalizeSettings', () => {
  it('retombe sur les valeurs par défaut', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ baseLayer: 'xyz', din: { flatKmh: -1, ascentMh: 350 } })).toEqual({
      ...DEFAULT_SETTINGS,
      din: { ...DEFAULT_SETTINGS.din, ascentMh: 350 },
    });
  });
});

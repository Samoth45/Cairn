import { describe, expect, it } from 'vitest';
import { daylightInfo, isNightHour, parisMinutes, sunTimes } from './sun';
import { currentHourIndex, formatForecastHour, resolveHourIndex } from './forecast';
import { formatWindDir } from './format';

/** « 07:28 » heure de Paris. */
const hm = (d: Date | null) =>
  d ? `${String(Math.floor(parisMinutes(d) / 60)).padStart(2, '0')}:${String(parisMinutes(d) % 60).padStart(2, '0')}` : null;
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

describe('lever / coucher du soleil', () => {
  // Références : API Open-Meteo (daily=sunrise,sunset) pour le 12/11/2026.
  it.each([
    ['Chamonix', 45.9437, 6.8854, '07:28', '17:04'],
    ['Vercors', 44.993, 5.548, '07:31', '17:12'],
  ])('%s : à ±2 min des valeurs de référence', (_, lat, lon, rise, set) => {
    const t = sunTimes('2026-11-12', lat, lon);
    expect(Math.abs(minutes(hm(t.sunrise)!) - minutes(rise))).toBeLessThanOrEqual(2);
    expect(Math.abs(minutes(hm(t.sunset)!) - minutes(set))).toBeLessThanOrEqual(2);
  });

  it('gère l’heure d’été (Paris, solstice : ~05:47 / ~21:58)', () => {
    const t = sunTimes('2026-06-21', 48.8566, 2.3522);
    expect(Math.abs(minutes(hm(t.sunrise)!) - minutes('05:47'))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutes(hm(t.sunset)!) - minutes('21:58'))).toBeLessThanOrEqual(3);
  });

  it('renvoie null en nuit polaire', () => {
    expect(sunTimes('2026-12-21', 80, 15)).toEqual({ sunrise: null, sunset: null });
  });

  it('calcule le départ au plus tard et détecte une rando trop longue', () => {
    const ok = daylightInfo('2026-11-12', 45.9437, 6.8854, 5);
    expect(ok.daylightHours).toBeGreaterThan(9.4);
    expect(ok.daylightHours).toBeLessThan(9.8);
    expect(hm(ok.latestStart)).toBe(hm(new Date(ok.sunset!.getTime() - 5 * 3600000)));
    expect(ok.longerThanDay).toBe(false);
    expect(daylightInfo('2026-11-12', 45.9437, 6.8854, 11).longerThanDay).toBe(true);
    expect(daylightInfo('2026-11-12', 45.9437, 6.8854, null).latestStart).toBeNull();
  });

  it('repère les heures de nuit', () => {
    const t = sunTimes('2026-11-12', 45.9437, 6.8854); // ~07:28 → ~17:04
    expect(isNightHour('2026-11-12T06:00', t)).toBe(true);
    expect(isNightHour('2026-11-12T07:00', t)).toBe(false); // milieu 07:30, déjà levé
    expect(isNightHour('2026-11-12T16:00', t)).toBe(false);
    expect(isNightHour('2026-11-12T17:00', t)).toBe(true);
  });
});

describe('heure affichée', () => {
  const times = ['2026-11-12T13:00', '2026-11-12T14:00', '2026-11-12T15:00'];
  it('prend l’heure courante par défaut, la sélection si elle concerne la même prévision', () => {
    const now = new Date('2026-11-12T13:20:00Z'); // 14:20 à Paris
    expect(currentHourIndex(times, now)).toBe(1);
    expect(resolveHourIndex(times, 'k', { key: 'k', index: 2 })).toBe(2);
    expect(resolveHourIndex(times, 'k', { key: 'k', index: 99 })).toBe(2);
    expect(resolveHourIndex(times, 'autre', { key: 'k', index: 0 })).toBe(currentHourIndex(times));
  });
  it('formate l’heure et la direction du vent', () => {
    expect(formatForecastHour('2026-11-12T14:00')).toBe('jeu. 12 nov. · 14 h');
    expect(formatWindDir(315)).toBe('NO');
    expect(formatWindDir(-10)).toBe('N');
    expect(formatWindDir(null)).toBe('');
  });
});

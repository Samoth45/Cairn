import { describe, expect, it } from 'vitest';
import {
  computeAlerts,
  dayHourIndices,
  detectInversion,
  forecastDays,
  formatHourRanges,
  indexForDay,
  summitIndex,
  tempColor,
} from './weatherTable';
import { HOURLY_VARS, type PointSeries } from '../services/weather';
import type { WeatherPoint } from './weatherPoints';

/** 2 jours complets d'heures. */
const TIMES = ['2026-11-12', '2026-11-13'].flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));

function series(over: Partial<Record<(typeof HOURLY_VARS)[number], number | null>> = {}): PointSeries {
  const base: Record<string, number | null> = {
    temperature_2m: 5,
    apparent_temperature: 3,
    precipitation: 0,
    precipitation_probability: 10,
    weather_code: 1,
    cloud_cover: 20,
    wind_speed_10m: 10,
    wind_gusts_10m: 20,
    wind_direction_10m: 270,
    freezing_level_height: 3000,
    temperature_850hPa: 2,
    temperature_700hPa: -6,
    ...over,
  };
  return Object.fromEntries(HOURLY_VARS.map((v) => [v, TIMES.map(() => base[v])])) as PointSeries;
}

const POINTS: WeatherPoint[] = [
  { lat: 0, lon: 0, ele: 2300, d: 5000, roles: ['summit'] },
  { lat: 0, lon: 0, ele: 1250, d: 0, roles: ['start'] },
];

describe('jours et heures du tableau', () => {
  it('liste les jours et les heures de 6 h à 21 h', () => {
    expect(forecastDays(TIMES)).toEqual(['2026-11-12', '2026-11-13']);
    const idx = dayHourIndices(TIMES, '2026-11-13');
    expect(idx).toHaveLength(16);
    expect(TIMES[idx[0]]).toBe('2026-11-13T06:00');
    expect(TIMES[idx.at(-1)!]).toBe('2026-11-13T21:00');
  });

  it('garde l’heure en changeant de jour, ou prend midi hors plage', () => {
    expect(TIMES[indexForDay(TIMES, '2026-11-13', 14)]).toBe('2026-11-13T14:00');
    expect(TIMES[indexForDay(TIMES, '2026-11-13', 23)]).toBe('2026-11-13T12:00'); // 23 h → midi
    expect(TIMES[indexForDay(TIMES, '2026-11-12', null)]).toBe('2026-11-12T12:00');
  });

  it('regroupe les heures consécutives', () => {
    expect(formatHourRanges([14, 8, 15, 16, 10])).toBe('8 h, 10 h, 14 h–16 h');
  });
});

describe('couleurs de température', () => {
  it('va du bleu (froid) au rouge (chaud), quasi blanc à 0 °C', () => {
    const rgb = (t: number) => tempColor(t).bg.match(/\d+/g)!.map(Number);
    const [r0, g0, b0] = rgb(0);
    expect(Math.min(r0, g0, b0)).toBeGreaterThan(220);
    const [rc, , bc] = rgb(-10);
    expect(bc).toBeGreaterThan(rc);
    const [rh, , bh] = rgb(25);
    expect(rh).toBeGreaterThan(bh);
    expect(tempColor(-20).fg).toBe('#ffffff'); // texte clair sur bleu foncé
    expect(tempColor(1).fg).toBe('#1d2327');
    expect(tempColor(null).bg).toBe('var(--nodata-bg)');
  });
});

describe('inversion de température', () => {
  it('rien en situation normale (il fait plus froid en altitude)', () => {
    expect(detectInversion([series(), series({ temperature_2m: 8 })], POINTS, 12)).toBeNull();
  });

  it('détecte de l’air plus chaud à 850 hPa qu’au sol dans la vallée', () => {
    const inv = detectInversion([series(), series({ temperature_2m: -2, temperature_850hPa: 6 })], POINTS, 12);
    expect(inv).not.toBeNull();
    expect(inv!.diff).toBeCloseTo(8);
    expect(inv!.lowerLabel).toMatch(/1\s250/);
    expect(inv!.upperLabel).toContain('850');
  });

  it('ne compare pas 850 hPa à un point situé au-dessus de ce niveau', () => {
    // Seul le sommet (2 300 m) est plus froid que 850 hPa : ce n'est pas une inversion.
    const s = [series({ temperature_2m: -1, temperature_850hPa: 4 }), series({ temperature_2m: 6, temperature_850hPa: 4 })];
    expect(detectInversion(s, POINTS, 12)).toBeNull();
  });

  it('détecte 700 hPa plus chaud que 850 hPa', () => {
    const s = [series({ temperature_850hPa: 0, temperature_700hPa: 3, temperature_2m: 5 })];
    const inv = detectInversion(s, [POINTS[0]], 12);
    expect(inv?.lowerLabel).toContain('850');
  });
});

describe('alertes', () => {
  const day = dayHourIndices(TIMES, '2026-11-12');

  it('aucune alerte par beau temps', () => {
    expect(computeAlerts([series(), series()], POINTS, TIMES, day)).toEqual([]);
  });

  it('rafales > 50 km/h au sommet uniquement', () => {
    const strongBelow = computeAlerts([series(), series({ wind_gusts_10m: 80 })], POINTS, TIMES, day);
    expect(strongBelow.some((a) => a.kind === 'gusts')).toBe(false);
    const strongTop = computeAlerts([series({ wind_gusts_10m: 65 }), series()], POINTS, TIMES, day);
    expect(strongTop.find((a) => a.kind === 'gusts')?.message).toMatch(/65 km\/h au sommet/);
  });

  it('orage, ressenti < −5 °C et isotherme sous le sommet', () => {
    const alerts = computeAlerts(
      [series({ apparent_temperature: -9, freezing_level_height: 1800 }), series({ weather_code: 95 })],
      POINTS,
      TIMES,
      day,
    );
    expect(alerts.map((a) => a.kind).sort()).toEqual(['cold', 'freezing', 'storm']);
    expect(alerts.find((a) => a.kind === 'cold')!.message).toMatch(/−9 °C/);
    expect(alerts.find((a) => a.kind === 'freezing')!.message).toMatch(/1\s800 m/); // espace fine insécable
    expect(alerts.find((a) => a.kind === 'storm')!.message).toBe('Orage prévu : 6 h–21 h');
  });

  it('ignore les valeurs nulles', () => {
    const nulls = series({ wind_gusts_10m: null, apparent_temperature: null, freezing_level_height: null, weather_code: null });
    expect(computeAlerts([nulls, nulls], POINTS, TIMES, day)).toEqual([]);
  });

  it('trouve le sommet par son rôle', () => {
    expect(summitIndex([POINTS[1], POINTS[0]])).toBe(1);
  });
});

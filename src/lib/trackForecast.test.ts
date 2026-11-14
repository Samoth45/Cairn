import { describe, expect, it } from 'vitest';
import {
  coloredRuns,
  colorOf,
  departureIndex,
  formatClockMinutes,
  makeWeatherSampler,
  nearestProfileIndexByLatLng,
  NO_DATA_COLOR,
  parseClock,
  passageHours,
  type WeatherSample,
} from './trackForecast';
import { analyzeTrack, type ProfilePoint } from './stats';
import { dinDurationHours } from './din';
import { normalizeSettings } from './settings';
import { tempColor } from './weatherTable';
import { HOURLY_VARS, type ForecastData, type PointSeries } from '../services/weather';
import type { WeatherPoint } from './weatherPoints';
import { DEFAULT_DIN, type Point } from '../types';

/** Profil rectiligne vers le nord : `n` points espacés de ~111 m, altitudes données par `ele(i)`. */
function line(n: number, ele: (i: number) => number | null, seg = 0, lat0 = 45): ProfilePoint[] {
  return Array.from({ length: n }, (_, i) => ({ d: i * 111.195, lat: lat0 + i * 0.001, lon: 6, ele: ele(i), seg }));
}

describe('heures de passage (DIN tronçon par tronçon)', () => {
  it('à plat : 4 km/h', () => {
    const p = line(37, () => 1000); // 4 km
    const h = passageHours(p, DEFAULT_DIN, null);
    expect(h[0]).toBe(0);
    expect(h.at(-1)).toBeCloseTo(1, 1);
    for (let i = 1; i < h.length; i++) expect(h[i]).toBeGreaterThanOrEqual(h[i - 1]);
  });

  it('montée raide : le temps vertical domine (300 m/h)', () => {
    const p = line(11, (i) => 1000 + i * 30); // ~1,1 km, +300 m
    const h = passageHours(p, DEFAULT_DIN, null);
    // Par tronçon : vertical 0,1 h > horizontal ~0,028 h → ~1 h + moitié de l'horizontal.
    expect(h.at(-1)).toBeGreaterThan(1);
    expect(h.at(-1)).toBeLessThan(1.2);
  });

  it('se recale sur la durée DIN du tracé entier', () => {
    const segs: Point[][] = [Array.from({ length: 60 }, (_, i): Point => [45 + i * 0.001, 6, 1000 + (i < 30 ? i * 20 : (60 - i) * 20)])];
    const { stats, profile } = analyzeTrack(segs);
    const total = dinDurationHours(stats.distanceM / 1000, stats.ascentM!, stats.descentM!, DEFAULT_DIN);
    const h = passageHours(profile, DEFAULT_DIN, total);
    expect(h.at(-1)).toBeCloseTo(total, 6);
    // La montée (première moitié) prend plus de temps que la descente.
    expect(h[30]).toBeGreaterThan(total / 2);
  });
});

describe('horloge et indices horaires', () => {
  it('lit et formate les heures', () => {
    expect(parseClock('08:30')).toBe(510);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('8h')).toBeNull();
    expect(formatClockMinutes(510)).toBe('08:30');
    expect(formatClockMinutes(1440 + 70)).toBe('01:10 (+1 j)');
  });

  it('situe le départ dans les séries de la prévision', () => {
    const times = ['2026-11-12T00:00', '2026-11-12T01:00', '2026-11-13T00:00'];
    expect(departureIndex(times, '2026-11-13', 90)).toBe(3.5);
    expect(departureIndex(times, '2026-11-20', 90)).toBeNull();
  });
});

// Prévision simulée : 2 points (1000 m et 2000 m), 24 heures.
const TIMES = Array.from({ length: 24 }, (_, h) => `2026-11-12T${String(h).padStart(2, '0')}:00`);
function series(f: (h: number) => number | null, over: Partial<Record<(typeof HOURLY_VARS)[number], (h: number) => number | null>> = {}): PointSeries {
  const s = {} as PointSeries;
  for (const v of HOURLY_VARS) s[v] = TIMES.map((_, h) => (over[v] ? over[v](h) : v === 'temperature_2m' ? f(h) : 0));
  return s;
}
const POINTS: WeatherPoint[] = [
  { lat: 0, lon: 0, ele: 2000, d: 0, roles: ['summit'] },
  { lat: 0, lon: 0, ele: 1000, d: 0, roles: ['start'] },
];
const DATA: ForecastData = {
  times: TIMES,
  // Sommet : 0 °C à toute heure ; départ : température = heure (0 à 23 °C).
  points: [series(() => 0, { wind_gusts_10m: () => 60 }), series((h) => h, { wind_gusts_10m: () => 10 })],
  primary: TIMES.map(() => true),
};

describe('météo à une altitude et un instant', () => {
  const sample = makeWeatherSampler(DATA, POINTS);

  it('interpole linéairement en altitude et dans le temps', () => {
    expect(sample(1000, 10)!.temperature).toBe(10);
    expect(sample(1000, 10.5)!.temperature).toBeCloseTo(10.5);
    expect(sample(1500, 10)!.temperature).toBeCloseTo(5); // à mi-hauteur entre 10 °C et 0 °C
    expect(sample(1500, 10)!.gusts).toBeCloseTo(35);
  });

  it('prend le point le plus proche hors de la plage d’altitudes', () => {
    expect(sample(500, 12)!.temperature).toBe(12);
    expect(sample(3000, 12)!.temperature).toBe(0);
  });

  it('renvoie null au-delà de la prévision', () => {
    expect(sample(1000, 23)).not.toBeNull();
    expect(sample(1000, 23.5)).toBeNull();
    expect(sample(1000, -1)).toBeNull();
  });

  it('se rabat sur la valeur disponible si une heure est nulle', () => {
    const holes: ForecastData = { ...DATA, points: [series(() => null), series((h) => (h === 11 ? null : h))] };
    const s = makeWeatherSampler(holes, POINTS);
    expect(s(1000, 10.5)!.temperature).toBe(10);
    expect(s(1500, 10)!.temperature).toBe(10); // sommet sans valeur → valeur du départ
  });
});

describe('couleurs et tronçons', () => {
  const s = (o: Partial<WeatherSample>): WeatherSample => ({
    temperature: null,
    apparent: null,
    wind: null,
    gusts: null,
    direction: null,
    precipitation: null,
    probability: null,
    code: null,
    ...o,
  });

  it('classe les valeurs', () => {
    expect(colorOf('temperature', s({ temperature: 4.6 }))).toEqual({ key: 't5', color: tempColor(5).bg });
    expect(colorOf('gusts', s({ gusts: 55 })).key).toBe('gusts3');
    expect(colorOf('precipitation', s({ precipitation: 0 })).key).toBe('precipitation0');
    expect(colorOf('precipitation', s({ precipitation: 3 })).key).toBe('precipitation4');
    expect(colorOf('gusts', null).color).toBe(NO_DATA_COLOR);
  });

  it('fusionne les morceaux de même couleur et coupe entre segments', () => {
    const profile = [...line(5, () => 1000, 0), ...line(5, () => 1000, 1, 46)];
    const hours = profile.map(() => 0);
    const sample = makeWeatherSampler(DATA, POINTS);
    const runs = coloredRuns(profile, hours, sample, 10, 'temperature');
    // Même température partout → une ligne par segment, jamais de trait entre les deux segments.
    expect(runs).toHaveLength(2);
    expect(runs[0].positions[0]).toEqual([45, 6]);
    expect(runs[1].positions[0][0]).toBeCloseTo(46);
  });

  it('change de couleur quand la météo change au fil du temps', () => {
    const profile = line(11, () => 1000);
    const hours = profile.map((_, i) => i); // 1 h entre chaque point : 1 °C de plus à chaque fois
    const runs = coloredRuns(profile, hours, makeWeatherSampler(DATA, POINTS), 0, 'temperature');
    expect(runs.length).toBeGreaterThan(5);
    // Points espacés de 111 m > 100 m : chaque tronçon est coupé en deux morceaux.
    // 1er morceau pris à 0,25 h → 0,25 °C → 0 °C ; dernier à 9,75 h → 10 °C.
    expect(runs[0].color).toBe(tempColor(0).bg);
    expect(runs.at(-1)!.color).toBe(tempColor(10).bg);
  });

  it('subdivise les tronçons longs (points espacés)', () => {
    const sparse: ProfilePoint[] = [
      { d: 0, lat: 45, lon: 6, ele: 1000, seg: 0 },
      { d: 1111.95, lat: 45.01, lon: 6, ele: 2000, seg: 0 },
    ];
    const runs = coloredRuns(sparse, [0, 0], makeWeatherSampler(DATA, POINTS), 12, 'temperature');
    // 12 °C en bas → 0 °C en haut : plusieurs couleurs sur ce seul tronçon de 1,1 km.
    expect(runs.length).toBeGreaterThan(5);
  });

  it('retrouve le point du profil le plus proche', () => {
    const profile = line(10, () => 1000);
    expect(nearestProfileIndexByLatLng(profile, 45.0042, 6.0001)).toBe(4);
  });
});

describe('paramètres de l’étape 5', () => {
  it('valide la coloration et l’heure de départ', () => {
    expect(normalizeSettings({ trackColoring: 'gusts', departureTime: '07:15' })).toMatchObject({
      trackColoring: 'gusts',
      departureTime: '07:15',
    });
    expect(normalizeSettings({ trackColoring: 'vent', departureTime: '25:00' })).toMatchObject({
      trackColoring: 'none',
      departureTime: '08:00',
    });
  });
});

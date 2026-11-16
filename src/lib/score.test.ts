import { describe, expect, it } from 'vitest';
import {
  cloudSeverity,
  coldSeverity,
  computeDayScore,
  gustSeverity,
  rainSeverity,
  reliability,
  scoreColor,
  type ScoreInput,
} from './score';
import { makeWeatherSampler } from './trackForecast';
import { normalizeSettings } from './settings';
import { nextDays } from './time';
import { HOURLY_VARS, type ForecastData, type PointSeries } from '../services/weather';
import type { ProfilePoint } from './stats';
import type { WeatherPoint } from './weatherPoints';
import { DEFAULT_SCORE_WEIGHTS, DEFAULT_SETTINGS } from '../types';

const TIMES = Array.from({ length: 48 }, (_, h) => `2026-11-${12 + Math.floor(h / 24)}T${String(h % 24).padStart(2, '0')}:00`);
type Over = Partial<Record<(typeof HOURLY_VARS)[number], (h: number) => number | null>>;
const BASE: Record<string, number> = {
  temperature_2m: 8,
  apparent_temperature: 6,
  precipitation: 0,
  precipitation_probability: 0,
  weather_code: 1,
  cloud_cover: 10,
  wind_speed_10m: 10,
  wind_gusts_10m: 20,
  wind_direction_10m: 270,
  freezing_level_height: 3000,
  temperature_850hPa: 5,
  temperature_700hPa: -3,
};
function series(over: Over = {}): PointSeries {
  return Object.fromEntries(HOURLY_VARS.map((v) => [v, TIMES.map((_, h) => (over[v] ? over[v](h) : BASE[v]))])) as PointSeries;
}

const POINTS: WeatherPoint[] = [
  { lat: 0, lon: 0, ele: 2000, d: 4000, roles: ['summit'] },
  { lat: 0, lon: 0, ele: 1000, d: 0, roles: ['start'] },
];
// Profil aller : départ à 1 000 m, sommet à 2 000 m ; 4 h de marche.
const PROFILE: ProfilePoint[] = Array.from({ length: 41 }, (_, i) => ({ d: i * 100, lat: 45 + i * 0.001, lon: 6, ele: 1000 + i * 25, seg: 0 }));
const PASSAGE = PROFILE.map((_, i) => (i / 40) * 4);

function input(summit: Over = {}, start: Over = {}, startIndex = 8): ScoreInput {
  const data: ForecastData = { times: TIMES, points: [series(summit), series(start)], primary: TIMES.map(() => true) };
  return { data, points: POINTS, profile: PROFILE, passage: PASSAGE, sample: makeWeatherSampler(data, POINTS), startIndex, durationHours: 4 };
}

describe('gravités', () => {
  it('suivent les seuils annoncés', () => {
    expect(rainSeverity(0, 0)).toBe(0);
    expect(rainSeverity(5, 0)).toBe(1);
    expect(rainSeverity(0, 100)).toBeCloseTo(0.6);
    expect(gustSeverity(30)).toBe(0);
    expect(gustSeverity(50)).toBeCloseTo(0.5);
    expect(gustSeverity(90)).toBe(1);
    expect(cloudSeverity(50)).toBe(0);
    expect(cloudSeverity(100)).toBe(1);
    expect(coldSeverity(-5)).toBe(0);
    expect(coldSeverity(-20)).toBe(1);
  });
});

describe('score d’une journée', () => {
  it('vaut 100 par beau temps', () => {
    const s = computeDayScore(input(), DEFAULT_SCORE_WEIGHTS)!;
    expect(s.score).toBe(100);
    expect(s.coverage).toBe(1);
    expect(s.penalties.every((p) => p.points === 0)).toBe(true);
  });

  it('pénalise la pluie le long du parcours, pendant la rando seulement', () => {
    // 2 mm/h partout de 8 h à 12 h (pendant la rando) : 8 mm → gravité 1.
    const wet = (h: number) => (h >= 8 && h <= 12 ? 2 : 0);
    const s = computeDayScore(input({ precipitation: wet }, { precipitation: wet }), DEFAULT_SCORE_WEIGHTS)!;
    expect(s.score).toBe(100 - DEFAULT_SCORE_WEIGHTS.rain);
    // Même pluie l'après-midi, rando le matin : aucune pénalité.
    const later = (h: number) => (h >= 14 && h <= 18 ? 2 : 0);
    expect(computeDayScore(input({ precipitation: later }, { precipitation: later }), DEFAULT_SCORE_WEIGHTS)!.score).toBe(100);
  });

  it('rafales et nébulosité : seulement au sommet', () => {
    const windyTop = computeDayScore(input({ wind_gusts_10m: () => 70, cloud_cover: () => 100 }), DEFAULT_SCORE_WEIGHTS)!;
    expect(windyTop.score).toBe(100 - DEFAULT_SCORE_WEIGHTS.gusts - DEFAULT_SCORE_WEIGHTS.clouds);
    const windyBottom = computeDayScore(input({}, { wind_gusts_10m: () => 70, cloud_cover: () => 100 }), DEFAULT_SCORE_WEIGHTS)!;
    expect(windyBottom.score).toBe(100);
  });

  it('orage : pénalité pleine pendant la rando, moitié juste avant ou après', () => {
    const during = computeDayScore(input({}, { weather_code: (h) => (h === 10 ? 95 : 1) }), DEFAULT_SCORE_WEIGHTS)!;
    expect(during.score).toBe(100 - DEFAULT_SCORE_WEIGHTS.storm);
    const after = computeDayScore(input({}, { weather_code: (h) => (h === 13 ? 95 : 1) }), DEFAULT_SCORE_WEIGHTS)!;
    expect(after.score).toBe(100 - DEFAULT_SCORE_WEIGHTS.storm / 2);
  });

  it('froid extrême : ressenti minimal là où l’on passe', () => {
    const s = computeDayScore(input({ apparent_temperature: () => -20 }, { apparent_temperature: () => -20 }), DEFAULT_SCORE_WEIGHTS)!;
    expect(s.score).toBe(100 - DEFAULT_SCORE_WEIGHTS.cold);
  });

  it('respecte les poids réglés (0 = pénalité ignorée) et reste entre 0 et 100', () => {
    const storm = input({ wind_gusts_10m: () => 120, cloud_cover: () => 100 }, { weather_code: () => 95, precipitation: () => 10 });
    expect(computeDayScore(storm, DEFAULT_SCORE_WEIGHTS)!.score).toBe(0);
    expect(computeDayScore(storm, { rain: 0, storm: 0, gusts: 0, clouds: 0, cold: 0 })!.score).toBe(100);
  });

  it('prévision partielle ou absente', () => {
    // Départ à 22 h le 2e jour : la rando dépasse la fin des séries (47 h).
    const partial = computeDayScore(input({}, {}, 24 + 22), DEFAULT_SCORE_WEIGHTS)!;
    expect(partial.coverage).toBeGreaterThan(0);
    expect(partial.coverage).toBeLessThan(1);
    expect(computeDayScore(input({}, {}, 60), DEFAULT_SCORE_WEIGHTS)).toBeNull();
  });
});

describe('affichage', () => {
  it('fiabilité selon l’échéance', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(reliability)).toEqual(['good', 'good', 'good', 'medium', 'medium', 'low', 'low']);
  });
  it('couleur du score : rouge → vert', () => {
    expect(scoreColor(0).bg).toBe('hsl(0, 68%, 82%)');
    expect(scoreColor(100).bg).toBe('hsl(125, 68%, 82%)');
    expect(scoreColor(null).bg).toBe('var(--nodata-bg)');
  });
  it('jours consécutifs, y compris en changeant de mois', () => {
    expect(nextDays('2026-11-29', 4)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  });
  it('poids : défauts, valeur 0 acceptée, valeurs invalides rejetées', () => {
    expect(normalizeSettings(undefined).scoreWeights).toEqual(DEFAULT_SETTINGS.scoreWeights);
    expect(normalizeSettings({ scoreWeights: { rain: 0, storm: 150, gusts: -1, clouds: 'x' } }).scoreWeights).toEqual({
      ...DEFAULT_SCORE_WEIGHTS,
      rain: 0,
    });
  });
});

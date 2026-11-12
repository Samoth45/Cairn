import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rolesLabel, selectWeatherPoints, MAX_WEATHER_POINTS, type WeatherPoint } from './weatherPoints';
import type { ProfilePoint } from './stats';
import { parisHourKey } from './time';
import { wmoLabel, isThunderstorm } from './wmo';
import { formatTemp } from './format';
import { buildForecastUrl, fetchForecast, HOURLY_VARS, parseForecastResponse, WeatherError } from '../services/weather';
import { getTrackForecast, deleteTrackForecast, WEATHER_TTL_MS } from '../services/weatherCache';
import { db } from '../db/db';

/** Profil : départ à `start` m, montée linéaire jusqu'à `summit`, puis descente jusqu'à `end`. */
function profile(start: number, summit: number, end: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  const n = 200;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ele = t <= 0.5 ? start + (summit - start) * (t / 0.5) : summit + (end - summit) * ((t - 0.5) / 0.5);
    out.push({ d: i * 50, lat: 45 + i * 0.0005, lon: 6, ele });
  }
  return out;
}

describe('points d’échantillonnage météo', () => {
  it('prend sommet, départ et points tous les ~400 m, triés du haut vers le bas', () => {
    const pts = selectWeatherPoints(profile(1000, 2500, 1000));
    const eles = pts.map((p) => Math.round(p.ele));
    expect(eles[0]).toBe(2500);
    expect(eles.at(-1)).toBe(1000);
    expect(pts[0].roles).toEqual(['summit']);
    expect(pts.at(-1)!.roles).toEqual(['start']);
    // 1000 → 2500 : intermédiaires à ~1400, 1800, 2200.
    expect(eles).toHaveLength(5);
    for (let i = 1; i < eles.length; i++) expect(eles[i - 1] - eles[i]).toBeGreaterThanOrEqual(200);
  });

  it('ajoute le point bas s’il est nettement sous le départ (vallon, descente initiale)', () => {
    const pts = selectWeatherPoints(profile(1500, 2000, 900));
    const lowest = pts.find((p) => p.roles.includes('lowest'));
    expect(lowest?.ele).toBeCloseTo(900);
    expect(pts.find((p) => p.roles.includes('start'))?.ele).toBeCloseTo(1500);
  });

  it('fusionne les points à moins de 200 m d’altitude', () => {
    // Balade quasi plate : départ et sommet fusionnés en un seul point.
    const pts = selectWeatherPoints(profile(1000, 1150, 1000));
    expect(pts).toHaveLength(1);
    expect(pts[0].roles).toEqual(['summit', 'start']);
    expect(rolesLabel(pts[0].roles)).toBe('Sommet · Départ');
  });

  it('ne dépasse jamais 8 points', () => {
    const pts = selectWeatherPoints(profile(500, 4800, 500));
    expect(pts.length).toBeLessThanOrEqual(MAX_WEATHER_POINTS);
    expect(pts[0].ele).toBeCloseTo(4800);
    expect(pts.at(-1)!.ele).toBeCloseTo(500);
  });

  it('renvoie une liste vide sans altitude', () => {
    expect(selectWeatherPoints([{ d: 0, lat: 45, lon: 6, ele: null }])).toEqual([]);
  });
});

const POINTS: WeatherPoint[] = [
  { lat: 45.97, lon: 6.87, ele: 2352, d: 3000, roles: ['summit'] },
  { lat: 45.94, lon: 6.88, ele: 1460.4, d: 0, roles: ['start'] },
];

/** Réponse Open-Meteo simulée : 3 heures, modèles combinés (MF absent à la 3e heure). */
function fakeResponse(combined = true) {
  const time = ['2026-11-12T00:00', '2026-11-12T01:00', '2026-11-12T02:00'];
  return POINTS.map((p) => {
    const hourly: Record<string, unknown> = { time };
    for (const v of HOURLY_VARS) {
      if (combined) {
        hourly[`${v}_meteofrance_seamless`] =
          v === 'precipitation_probability' || v === 'freezing_level_height' ? [null, null, null] : [1, 2, null];
        hourly[`${v}_best_match`] = [10, 20, 30];
      } else {
        hourly[v] = [10, null, 30];
      }
    }
    return { latitude: p.lat, longitude: p.lon, elevation: p.ele, hourly };
  });
}

describe('service météo Open-Meteo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('construit une seule requête multi-points avec les altitudes réelles', () => {
    const url = new URL(buildForecastUrl(POINTS, 'meteofrance_seamless'));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('45.97000,45.94000');
    expect(url.searchParams.get('elevation')).toBe('2352,1460');
    expect(url.searchParams.get('models')).toBe('meteofrance_seamless,best_match');
    expect(url.searchParams.get('timezone')).toBe('Europe/Paris');
    expect(url.searchParams.get('forecast_days')).toBe('7');
    expect(url.searchParams.get('hourly')!.split(',')).toEqual([...HOURLY_VARS]);
    expect(new URL(buildForecastUrl(POINTS, 'best_match')).searchParams.get('models')).toBe('best_match');
  });

  it('complète les valeurs absentes d’AROME/ARPEGE par best_match', () => {
    const data = parseForecastResponse(fakeResponse(), 'meteofrance_seamless', 2);
    expect(data.times).toHaveLength(3);
    expect(data.points[0].temperature_2m).toEqual([1, 2, 30]);
    expect(data.points[1].freezing_level_height).toEqual([10, 20, 30]);
    expect(data.primary).toEqual([true, true, false]);
  });

  it('conserve les valeurs nulles en mode best_match (affichées « – »)', () => {
    const data = parseForecastResponse(fakeResponse(false), 'best_match', 2);
    expect(data.points[0].temperature_2m).toEqual([10, null, 30]);
    expect(formatTemp(data.points[0].temperature_2m[1])).toBe('–');
    expect(data.primary).toEqual([true, true, true]);
  });

  it('accepte la réponse objet d’un point unique et rejette une réponse incohérente', () => {
    expect(parseForecastResponse(fakeResponse()[0], 'meteofrance_seamless', 1).points).toHaveLength(1);
    expect(() => parseForecastResponse(fakeResponse(), 'meteofrance_seamless', 3)).toThrow(WeatherError);
    expect(() => parseForecastResponse({ error: true }, 'best_match', 1)).toThrow(WeatherError);
  });

  it('remonte des erreurs lisibles', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: true, reason: 'Paramètre invalide' }), { status: 400 }));
    await expect(fetchForecast(POINTS, 'best_match')).rejects.toThrow(/400 : Paramètre invalide/);
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('network');
    });
    await expect(fetchForecast(POINTS, 'best_match')).rejects.toThrow(/injoignable/);
  });
});

describe('cache des prévisions (1 h)', () => {
  let calls = 0;
  beforeEach(async () => {
    calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return new Response(JSON.stringify(fakeResponse()));
    });
    await deleteTrackForecast('t1');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ne refait pas l’appel avant 1 heure, sauf actualisation forcée', async () => {
    const now = Date.now();
    await getTrackForecast('t1', POINTS, 'meteofrance_seamless', { now });
    await getTrackForecast('t1', POINTS, 'meteofrance_seamless', { now: now + WEATHER_TTL_MS - 1000 });
    expect(calls).toBe(1);
    await getTrackForecast('t1', POINTS, 'meteofrance_seamless', { now: now + WEATHER_TTL_MS + 1000 });
    expect(calls).toBe(2);
    await getTrackForecast('t1', POINTS, 'meteofrance_seamless', { force: true });
    expect(calls).toBe(3);
  });

  it('persiste dans IndexedDB et se recharge si le modèle ou les points changent', async () => {
    await getTrackForecast('t1', POINTS, 'meteofrance_seamless');
    expect((await db.weather.get('t1'))?.model).toBe('meteofrance_seamless');
    await getTrackForecast('t1', POINTS, 'best_match');
    expect(calls).toBe(2);
    await getTrackForecast('t1', POINTS.slice(0, 1), 'best_match').catch(() => undefined);
    expect(calls).toBe(3);
  });

  it('supprime la prévision avec le tracé', async () => {
    await getTrackForecast('t1', POINTS, 'meteofrance_seamless');
    await deleteTrackForecast('t1');
    expect(await db.weather.get('t1')).toBeUndefined();
  });
});

describe('utilitaires', () => {
  it('donne l’heure de Paris au format Open-Meteo', () => {
    expect(parisHourKey(new Date('2026-07-01T10:30:00Z'))).toBe('2026-07-01T12:00'); // heure d'été
    expect(parisHourKey(new Date('2026-01-01T23:10:00Z'))).toBe('2026-01-02T00:00'); // heure d'hiver
  });
  it('traduit les codes WMO', () => {
    expect(wmoLabel(95)).toBe('Orage');
    expect(wmoLabel(null)).toBe('–');
    expect(isThunderstorm(96)).toBe(true);
    expect(isThunderstorm(63)).toBe(false);
  });
});

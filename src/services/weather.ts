import type { WeatherModel } from '../types';

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'freezing_level_height',
  'temperature_850hPa',
  'temperature_700hPa',
] as const;

export type HourlyVar = (typeof HOURLY_VARS)[number];

/** Séries horaires d'un point ; une valeur peut être null (absente du modèle à cette échéance). */
export type PointSeries = Record<HourlyVar, Array<number | null>>;

export interface ForecastData {
  /** Heures locales (Europe/Paris), format « 2026-11-12T14:00 ». */
  times: string[];
  /** Une série par point, dans l'ordre des points demandés. */
  points: PointSeries[];
  /**
   * Pour chaque heure : true si le modèle principal (AROME/ARPEGE) a fourni la température.
   * Sinon, les valeurs viennent du modèle de secours (best_match).
   */
  primary: boolean[];
}

export const MODEL_LABELS: Record<WeatherModel, string> = {
  meteofrance_seamless: 'Météo-France (AROME/ARPEGE)',
  best_match: 'Open-Meteo (meilleur modèle)',
};

/** Modèle de secours utilisé pour compléter les valeurs absentes du modèle principal. */
const FALLBACK_MODEL = 'best_match';

export class WeatherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherError';
  }
}

export interface ForecastLocation {
  lat: number;
  lon: number;
  ele: number;
}

export function buildForecastUrl(points: ForecastLocation[], model: WeatherModel): string {
  // Météo-France ne fournit ni probabilité de pluie ni isotherme 0 °C, et s'arrête vers J+4 :
  // on demande aussi best_match dans la même requête pour compléter les trous.
  const models = model === FALLBACK_MODEL ? model : `${model},${FALLBACK_MODEL}`;
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(5)).join(','),
    longitude: points.map((p) => p.lon.toFixed(5)).join(','),
    elevation: points.map((p) => Math.round(p.ele)).join(','),
    hourly: HOURLY_VARS.join(','),
    models,
    timezone: 'Europe/Paris',
    forecast_days: '7',
  });
  return `${ENDPOINT}?${params}`;
}

type RawHourly = Record<string, unknown>;

function series(hourly: RawHourly, key: string, n: number): Array<number | null> | null {
  const v = hourly[key];
  if (!Array.isArray(v)) return null;
  return Array.from({ length: n }, (_, i) => (typeof v[i] === 'number' && Number.isFinite(v[i]) ? v[i] : null));
}

/** Analyse la réponse (objet pour un point, tableau pour plusieurs). */
export function parseForecastResponse(json: unknown, model: WeatherModel, expectedPoints: number): ForecastData {
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== expectedPoints) throw new WeatherError('réponse inattendue du service météo');

  const combined = model !== FALLBACK_MODEL;
  let times: string[] = [];
  let primary: boolean[] = [];
  const points: PointSeries[] = list.map((item, idx) => {
    const hourly = (item as { hourly?: RawHourly })?.hourly;
    if (!hourly || !Array.isArray(hourly.time)) throw new WeatherError('réponse inattendue du service météo');
    const t = hourly.time.map(String);
    if (idx === 0) times = t;
    const n = times.length;

    const out = {} as PointSeries;
    for (const v of HOURLY_VARS) {
      if (!combined) {
        out[v] = series(hourly, v, n) ?? Array(n).fill(null);
        continue;
      }
      const main = series(hourly, `${v}_${model}`, n);
      const fb = series(hourly, `${v}_${FALLBACK_MODEL}`, n);
      out[v] = Array.from({ length: n }, (_, i) => main?.[i] ?? fb?.[i] ?? null);
      if (idx === 0 && v === 'temperature_2m') primary = Array.from({ length: n }, (_, i) => main?.[i] != null);
    }
    return out;
  });

  if (!combined) primary = times.map(() => true);
  return { times, points, primary };
}

/** Une seule requête pour tous les points d'un tracé. */
export async function fetchForecast(points: ForecastLocation[], model: WeatherModel, signal?: AbortSignal): Promise<ForecastData> {
  if (points.length === 0) throw new WeatherError('aucun point de prévision');
  let res: Response;
  try {
    res = await fetch(buildForecastUrl(points, model), { signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new WeatherError('service météo injoignable (connexion internet ?)');
  }
  if (res.status === 429) throw new WeatherError('trop de requêtes vers le service météo, réessayez dans une minute');
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = (json as { reason?: unknown } | null)?.reason;
    throw new WeatherError(`le service météo a répondu par une erreur (${res.status}${typeof reason === 'string' ? ` : ${reason}` : ''})`);
  }
  return parseForecastResponse(json, model, points.length);
}

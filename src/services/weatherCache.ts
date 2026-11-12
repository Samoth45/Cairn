import { db, type CachedForecast } from '../db/db';
import type { WeatherModel } from '../types';
import { weatherPointsKey, type WeatherPoint } from '../lib/weatherPoints';
import { fetchForecast } from './weather';

/** Durée de validité d'une prévision en cache. */
export const WEATHER_TTL_MS = 60 * 60 * 1000;

const memory = new Map<string, CachedForecast>();

export function forecastKey(points: WeatherPoint[], model: WeatherModel): string {
  return `${model}|${weatherPointsKey(points)}`;
}

function isFresh(entry: CachedForecast | undefined, key: string, now: number): entry is CachedForecast {
  return !!entry && entry.key === key && now - entry.fetchedAt < WEATHER_TTL_MS;
}

/**
 * Prévision d'un tracé : cache mémoire, puis IndexedDB, puis appel réseau.
 * `force` ignore le cache (bouton « Actualiser »).
 */
export async function getTrackForecast(
  trackId: string,
  points: WeatherPoint[],
  model: WeatherModel,
  opts: { force?: boolean; signal?: AbortSignal; now?: number } = {},
): Promise<CachedForecast> {
  const now = opts.now ?? Date.now();
  const key = forecastKey(points, model);

  if (!opts.force) {
    const mem = memory.get(trackId);
    if (isFresh(mem, key, now)) return mem;
    const stored = await db.weather.get(trackId);
    if (isFresh(stored, key, now)) {
      memory.set(trackId, stored);
      return stored;
    }
  }

  const data = await fetchForecast(points, model, opts.signal);
  const entry: CachedForecast = { trackId, key, model, fetchedAt: Date.now(), points, data };
  memory.set(trackId, entry);
  await db.weather.put(entry);
  return entry;
}

/** Dernière prévision connue (même périmée), pour l'afficher pendant le rechargement. */
export function peekTrackForecast(trackId: string): CachedForecast | undefined {
  return memory.get(trackId);
}

export async function deleteTrackForecast(trackId: string): Promise<void> {
  memory.delete(trackId);
  await db.weather.delete(trackId);
}

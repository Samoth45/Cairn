import { useCallback, useEffect, useState } from 'react';
import type { CachedForecast } from '../db/db';
import type { WeatherModel } from '../types';
import type { WeatherPoint } from '../lib/weatherPoints';
import { WeatherError } from '../services/weather';
import { forecastKey, getTrackForecast, peekTrackForecast } from '../services/weatherCache';

export interface WeatherState {
  forecast: CachedForecast | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Issue d'une requête, mémorisée avec la requête qui l'a produite. */
interface WeatherResult {
  request: string;
  forecast: CachedForecast | null;
  error: string | null;
}

/** Prévision du tracé sélectionné (cache 1 h), rechargée si le tracé, ses points ou le modèle changent. */
export function useWeather(trackId: string | undefined, points: WeatherPoint[], model: WeatherModel): WeatherState {
  // Compteur d'actualisations forcées, propre au tracé qui l'a demandé.
  const [forced, setForced] = useState<{ trackId: string; n: number } | null>(null);
  const force = trackId && forced?.trackId === trackId ? forced.n : 0;
  const [result, setResult] = useState<WeatherResult | null>(null);

  const key = forecastKey(points, model);
  const active = Boolean(trackId) && points.length > 0;
  // Identifie la requête en cours : un résultat d'une autre requête est ignoré (pas de remise
  // à zéro de l'état dans l'effet, tout est déduit ici).
  const request = active ? `${trackId}|${key}|${force}` : null;

  useEffect(() => {
    if (!trackId || !request) return;
    const ctrl = new AbortController();
    getTrackForecast(trackId, points, model, { force: force > 0, signal: ctrl.signal })
      .then((f) => {
        if (!ctrl.signal.aborted) setResult({ request, forecast: f, error: null });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        if (!(e instanceof WeatherError)) console.error(e);
        setResult({ request, forecast: null, error: e instanceof WeatherError ? e.message : 'erreur inattendue' });
      });
    return () => ctrl.abort();
    // `points` et `model` sont entièrement décrits par `request` (via `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const refresh = useCallback(() => {
    if (trackId) setForced((f) => ({ trackId, n: (f?.trackId === trackId ? f.n : 0) + 1 }));
  }, [trackId]);

  if (!trackId || !request) return { forecast: null, loading: false, error: null, refresh };
  const done = result?.request === request ? result : null;
  // Pendant le chargement (ou après un échec), l'ancienne prévision de ce tracé reste affichée
  // si elle correspond aux mêmes points et au même modèle.
  const previous = peekTrackForecast(trackId);
  const fallback = previous && previous.key === key ? previous : null;
  return {
    forecast: done?.forecast ?? fallback,
    loading: done === null,
    error: done?.error ?? null,
    refresh,
  };
}

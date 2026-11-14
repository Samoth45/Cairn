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

/** Prévision du tracé sélectionné (cache 1 h), rechargée si le tracé, ses points ou le modèle changent. */
export function useWeather(trackId: string | undefined, points: WeatherPoint[], model: WeatherModel): WeatherState {
  const [forecast, setForecast] = useState<CachedForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Compteur d'actualisations forcées, propre au tracé qui l'a demandé.
  const [forced, setForced] = useState<{ trackId: string; n: number } | null>(null);
  const force = trackId && forced?.trackId === trackId ? forced.n : 0;

  const key = forecastKey(points, model);

  useEffect(() => {
    if (!trackId || points.length === 0) {
      setForecast(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    // Affiche l'ancienne prévision de ce tracé pendant le chargement, si elle existe.
    const previous = peekTrackForecast(trackId);
    setForecast(previous && previous.key === key ? previous : null);
    setLoading(true);
    setError(null);
    getTrackForecast(trackId, points, model, { force: force > 0, signal: ctrl.signal })
      .then((f) => {
        if (ctrl.signal.aborted) return;
        setForecast(f);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        if (!(e instanceof WeatherError)) console.error(e);
        setError(e instanceof WeatherError ? e.message : 'erreur inattendue');
        setLoading(false);
      });
    return () => ctrl.abort();
    // `points` est entièrement décrit par `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, key, force]);

  const refresh = useCallback(() => {
    if (trackId) setForced((f) => ({ trackId, n: (f?.trackId === trackId ? f.n : 0) + 1 }));
  }, [trackId]);
  return { forecast, loading, error, refresh };
}

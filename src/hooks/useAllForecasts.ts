import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CachedForecast } from '../db/db';
import type { Track, WeatherModel } from '../types';
import { analyzeTrack, type TrackAnalysis } from '../lib/stats';
import { needsElevation } from '../lib/elevation';
import { selectWeatherPoints, type WeatherPoint } from '../lib/weatherPoints';
import { WeatherError } from '../services/weather';
import { forecastKey, getTrackForecast } from '../services/weatherCache';

export interface TrackForecastEntry {
  track: Track;
  analysis: TrackAnalysis;
  points: WeatherPoint[];
  /** Altitudes pas encore récupérées : pas de prévision possible pour l'instant. */
  waiting: boolean;
  forecast: CachedForecast | null;
  loading: boolean;
  error: string | null;
}

/** Nombre de requêtes météo simultanées au plus (API gratuite : rester raisonnable). */
const CONCURRENCY = 2;

/**
 * Prévisions de tous les tracés (vue « Meilleur jour »), via le même cache d'une heure que le
 * tracé sélectionné. Actif seulement quand `enabled` (pas de requêtes tant que la vue est fermée).
 */
export function useAllForecasts(tracks: Track[] | undefined, model: WeatherModel, enabled: boolean) {
  // Analyse et points météo de chaque tracé (mêmes calculs que pour le tracé sélectionné,
  // donc mêmes clés de cache).
  const prepared = useMemo(
    () =>
      (tracks ?? []).map((track) => {
        const analysis = analyzeTrack(track.segments);
        const waiting = needsElevation(track);
        return { track, analysis, waiting, points: waiting ? [] : selectWeatherPoints(analysis.profile) };
      }),
    [tracks],
  );

  const [results, setResults] = useState<Record<string, { forecast: CachedForecast | null; error: string | null }>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [force, setForce] = useState(0);
  const lastForce = useRef(0);

  // Signature : ne relancer que si un tracé, ses points ou le modèle changent.
  const jobs = useMemo(
    () => prepared.filter((p) => !p.waiting && p.points.length > 0).map((p) => ({ id: p.track.id, points: p.points, key: forecastKey(p.points, model) })),
    [prepared, model],
  );
  const signature = jobs.map((j) => `${j.id}:${j.key}`).join('|');

  useEffect(() => {
    if (!enabled || jobs.length === 0) return;
    const ctrl = new AbortController();
    const forced = force !== lastForce.current;
    lastForce.current = force;
    const queue = [...jobs];
    setLoadingIds(new Set(queue.map((j) => j.id)));

    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { id, points } = job;
        try {
          const forecast = await getTrackForecast(id, points, model, { force: forced, signal: ctrl.signal });
          if (ctrl.signal.aborted) return;
          setResults((r) => ({ ...r, [id]: { forecast, error: null } }));
        } catch (e) {
          if (ctrl.signal.aborted) return;
          setResults((r) => ({ ...r, [id]: { forecast: null, error: e instanceof WeatherError ? e.message : 'erreur inattendue' } }));
        }
        setLoadingIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    };
    void Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return () => ctrl.abort();
    // `jobs` est entièrement décrit par `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature, model, force]);

  const entries: TrackForecastEntry[] = prepared.map((p) => {
    const r = results[p.track.id];
    const key = p.points.length ? forecastKey(p.points, model) : '';
    // Une prévision obtenue pour d'autres points ou un autre modèle est ignorée.
    const forecast = r?.forecast && r.forecast.key === key ? r.forecast : null;
    return {
      ...p,
      forecast,
      loading: loadingIds.has(p.track.id),
      error: forecast ? null : (r?.error ?? null),
    };
  });

  const refresh = useCallback(() => setForce((n) => n + 1), []);
  return { entries, refresh, loading: loadingIds.size > 0 };
}

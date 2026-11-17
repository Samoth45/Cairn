import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db/db';
import { needsElevation } from '../lib/elevation';
import { ElevationError, fetchTrackElevations } from '../services/elevation';
import type { Track } from '../types';

export type ElevationStatus = 'loading' | 'error' | 'done';

/**
 * Récupère en arrière-plan, un tracé à la fois, les altitudes manquantes via
 * Open-Meteo, puis les enregistre dans le tracé (l'appel n'est jamais refait).
 * Statut « loading » déduit : tracé qui attend ses altitudes, sans échec ni fin enregistrés
 * (en cours ou en file d'attente).
 */
export function useElevationFetcher(tracks: Track[] | undefined, onError: (track: Track, message: string) => void) {
  // Seulement les issues des appels (« done » / « error ») ; « loading » est déduit.
  const [status, setStatus] = useState<Record<string, ElevationStatus>>({});
  const busy = useRef(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!tracks || busy.current) return;
    const next = tracks.find((t) => needsElevation(t) && !status[t.id]);
    if (!next) return;

    busy.current = true;
    fetchTrackElevations(next.segments)
      .then(async (segments) => {
        await db.tracks.update(next.id, { segments, elevationSource: 'dem' });
        busy.current = false;
        setStatus((s) => ({ ...s, [next.id]: 'done' }));
      })
      .catch((e: unknown) => {
        if (!(e instanceof ElevationError)) console.error(e);
        busy.current = false;
        setStatus((s) => ({ ...s, [next.id]: 'error' }));
        onErrorRef.current(next, e instanceof ElevationError ? e.message : 'erreur inattendue');
      });
  }, [tracks, status]);

  /** Relance la récupération après un échec. */
  const retry = useCallback((id: string) => {
    setStatus((s) => {
      const copy = { ...s };
      delete copy[id];
      return copy;
    });
  }, []);

  const elevationStatus = useMemo(() => {
    const all: Record<string, ElevationStatus> = { ...status };
    for (const t of tracks ?? []) if (!all[t.id] && needsElevation(t)) all[t.id] = 'loading';
    return all;
  }, [tracks, status]);

  return { elevationStatus, retryElevation: retry };
}

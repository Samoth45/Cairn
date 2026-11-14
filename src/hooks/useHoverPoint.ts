import { useSyncExternalStore } from 'react';

export interface HoverPoint {
  lat: number;
  lon: number;
  /** Distance depuis le départ (m), pour retrouver le point du profil (heure de passage…). */
  d?: number;
}

/*
 * Petit store hors React pour la position survolée (profil ou tracé sur la carte) : le
 * survol change à chaque mouvement de souris, on évite ainsi de re-rendre toute l'application.
 */
let current: HoverPoint | null = null;
const listeners = new Set<() => void>();

export function setHoverPoint(p: HoverPoint | null) {
  if (p === current || (p && current && p.lat === current.lat && p.lon === current.lon && p.d === current.d)) return;
  current = p;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHoverPoint(): HoverPoint | null {
  return useSyncExternalStore(subscribe, () => current);
}

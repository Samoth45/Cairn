import type { Point } from '../types';

// Les calculs de distance / dénivelé arriveront ici à l'étape 2.

export type Bounds = [[south: number, west: number], [north: number, east: number]];

/** Emprise d'un ensemble de segments, ou null si vide. */
export function trackBounds(segments: Point[][]): Bounds | null {
  let s = Infinity;
  let w = Infinity;
  let n = -Infinity;
  let e = -Infinity;
  for (const seg of segments) {
    for (const [lat, lon] of seg) {
      if (lat < s) s = lat;
      if (lat > n) n = lat;
      if (lon < w) w = lon;
      if (lon > e) e = lon;
    }
  }
  return Number.isFinite(s) ? [[s, w], [n, e]] : null;
}

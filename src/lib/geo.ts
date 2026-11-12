import type { Point } from '../types';

export type Bounds = [[south: number, west: number], [north: number, east: number]];

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance orthodromique (formule de haversine) entre deux points, en mètres. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Distances cumulées (m) le long d'un segment, en commençant à 0. */
export function cumulativeDistances(seg: Point[]): number[] {
  const out = new Array<number>(seg.length);
  let total = 0;
  for (let i = 0; i < seg.length; i++) {
    if (i > 0) total += haversine(seg[i - 1][0], seg[i - 1][1], seg[i][0], seg[i][1]);
    out[i] = total;
  }
  return out;
}

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

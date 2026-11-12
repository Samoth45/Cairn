import type { Point } from '../types';
import { haversine } from './geo';
import { fillMissingElevations } from './elevation';

/** Seuil d'hystérésis (m) : une variation n'est comptée que si elle le dépasse. */
export const ELEVATION_THRESHOLD_M = 5;

export interface TrackStats {
  distanceM: number;
  /** null si le tracé n'a aucune altitude. */
  ascentM: number | null;
  descentM: number | null;
  minEle: number | null;
  maxEle: number | null;
  summit: { lat: number; lon: number; ele: number } | null;
}

export interface ProfilePoint {
  /** Distance cumulée depuis le départ, en mètres. */
  d: number;
  lat: number;
  lon: number;
  ele: number | null;
}

export interface TrackAnalysis {
  stats: TrackStats;
  profile: ProfilePoint[];
}

/**
 * D+ / D- avec hystérésis : l'altitude de référence n'avance que lorsque l'écart
 * dépasse le seuil, ce qui élimine le bruit GPS sans perdre les vraies montées.
 */
export function elevationGain(eles: number[], threshold = ELEVATION_THRESHOLD_M): { ascent: number; descent: number } {
  let ascent = 0;
  let descent = 0;
  if (eles.length === 0) return { ascent, descent };
  let ref = eles[0];
  for (let i = 1; i < eles.length; i++) {
    const diff = eles[i] - ref;
    if (diff >= threshold) {
      ascent += diff;
      ref = eles[i];
    } else if (diff <= -threshold) {
      descent -= diff;
      ref = eles[i];
    }
  }
  // Variation résiduelle en fin de tracé (sinon une petite dernière montée serait perdue).
  const last = eles[eles.length - 1] - ref;
  if (last > 0) ascent += last;
  else descent -= last;
  return { ascent, descent };
}

/**
 * Statistiques et profil altimétrique d'un tracé. Les altitudes manquantes isolées
 * sont interpolées. Les segments sont mis bout à bout (les sauts entre segments ne
 * comptent pas dans la distance).
 */
export function analyzeTrack(segments: Point[][]): TrackAnalysis {
  const filled = fillMissingElevations(segments);
  const profile: ProfilePoint[] = [];
  let distanceM = 0;
  let ascent = 0;
  let descent = 0;
  let hasEle = false;
  let minEle = Infinity;
  let maxEle = -Infinity;
  let summit: TrackStats['summit'] = null;

  for (const seg of filled) {
    const eles: number[] = [];
    for (let i = 0; i < seg.length; i++) {
      const [lat, lon, ele] = seg[i];
      if (i > 0) distanceM += haversine(seg[i - 1][0], seg[i - 1][1], lat, lon);
      profile.push({ d: distanceM, lat, lon, ele });
      if (ele === null) continue;
      hasEle = true;
      eles.push(ele);
      if (ele < minEle) minEle = ele;
      if (ele > maxEle) {
        maxEle = ele;
        summit = { lat, lon, ele };
      }
    }
    const gain = elevationGain(eles);
    ascent += gain.ascent;
    descent += gain.descent;
  }

  return {
    stats: {
      distanceM,
      ascentM: hasEle ? ascent : null,
      descentM: hasEle ? descent : null,
      minEle: hasEle ? minEle : null,
      maxEle: hasEle ? maxEle : null,
      summit,
    },
    profile,
  };
}

/** Indice du point de profil le plus proche d'une distance donnée (recherche dichotomique). */
export function nearestProfileIndex(profile: ProfilePoint[], d: number): number {
  if (profile.length === 0) return -1;
  let lo = 0;
  let hi = profile.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (profile[mid].d < d) lo = mid;
    else hi = mid;
  }
  return Math.abs(profile[lo].d - d) <= Math.abs(profile[hi].d - d) ? lo : hi;
}

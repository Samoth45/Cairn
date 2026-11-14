import type { Point } from '../types';
import { cumulativeDistances, haversine } from './geo';

/** En dessous de cette proportion de points avec altitude, on interroge le modèle de terrain. */
export const MIN_ELEVATION_COVERAGE = 0.8;

/** Proportion des points qui ont une altitude (0 à 1). */
export function elevationCoverage(segments: Point[][]): number {
  let total = 0;
  let withEle = 0;
  for (const seg of segments) {
    for (const p of seg) {
      total++;
      if (p[2] !== null) withEle++;
    }
  }
  return total === 0 ? 0 : withEle / total;
}

export function needsElevation(track: { segments: Point[][]; elevationSource?: string }): boolean {
  return track.elevationSource !== 'dem' && elevationCoverage(track.segments) < MIN_ELEVATION_COVERAGE;
}

/**
 * Remplit les altitudes manquantes par interpolation linéaire selon la distance
 * (valeur la plus proche aux extrémités). Segment sans aucune altitude : inchangé.
 */
export function fillMissingElevations(segments: Point[][]): Point[][] {
  return segments.map((seg) => {
    if (seg.every((p) => p[2] !== null)) return seg;
    const known = seg.map((p, i) => (p[2] !== null ? i : -1)).filter((i) => i >= 0);
    if (known.length === 0) return seg;
    const dist = cumulativeDistances(seg);
    const out = seg.map((p) => [...p] as Point);
    let k = 0;
    for (let i = 0; i < seg.length; i++) {
      if (seg[i][2] !== null) continue;
      while (k < known.length - 1 && known[k + 1] < i) k++;
      const a = known[k];
      const b = known[k + 1];
      if (i < a || b === undefined) {
        out[i][2] = seg[i < a ? a : known[known.length - 1]][2];
      } else {
        const span = dist[b] - dist[a];
        const t = span > 0 ? (dist[i] - dist[a]) / span : 0;
        out[i][2] = (seg[a][2] as number) + t * ((seg[b][2] as number) - (seg[a][2] as number));
      }
    }
    return out;
  });
}

/** Densifie un segment : ajoute des points intermédiaires pour qu'aucun écart ne dépasse `spacing` m. */
export function densify(seg: Point[], spacing: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < seg.length; i++) {
    if (i > 0) {
      const [lat1, lon1] = seg[i - 1];
      const [lat2, lon2] = seg[i];
      const d = haversine(lat1, lon1, lat2, lon2);
      const n = Math.ceil(d / spacing);
      for (let j = 1; j < n; j++) {
        const t = j / n;
        out.push([lat1 + t * (lat2 - lat1), lon1 + t * (lon2 - lon1), null]);
      }
    }
    out.push([seg[i][0], seg[i][1], seg[i][2]]);
  }
  return out;
}

export interface ElevationPlan {
  /** Segments densifiés, altitudes à remplacer. */
  segments: Point[][];
  /** Points à interroger : [indice de segment, indice de point]. */
  queries: Array<[number, number]>;
}

/**
 * Prépare la récupération des altitudes : densifie les segments trop lâches (routes)
 * et choisit des points régulièrement espacés à interroger, au plus `maxQueries`.
 */
export function planElevationQueries(segments: Point[][], minSpacing = 50, maxQueries = 1500): ElevationPlan {
  const total = segments.reduce((sum, seg) => sum + (cumulativeDistances(seg).at(-1) ?? 0), 0);
  const spacing = Math.max(minSpacing, total / maxQueries);
  const dense = segments.map((seg) => densify(seg, spacing));
  const queries: Array<[number, number]> = [];
  dense.forEach((seg, s) => {
    const dist = cumulativeDistances(seg);
    let last = -Infinity;
    for (let i = 0; i < seg.length; i++) {
      if (i === 0 || i === seg.length - 1 || dist[i] - last >= spacing) {
        queries.push([s, i]);
        last = dist[i];
      }
    }
  });
  return { segments: dense, queries };
}

/** Applique les altitudes obtenues aux points interrogés et interpole les autres. */
export function applyElevations(plan: ElevationPlan, values: number[]): Point[][] {
  const segs = plan.segments.map((seg) => seg.map((p): Point => [p[0], p[1], null]));
  plan.queries.forEach(([s, i], k) => {
    const v = values[k];
    if (typeof v === 'number' && Number.isFinite(v)) segs[s][i][2] = v;
  });
  return fillMissingElevations(segs);
}

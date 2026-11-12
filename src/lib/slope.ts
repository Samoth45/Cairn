/** Point de profil avec altitude connue. */
export interface ElePoint {
  /** Distance cumulée (m). */
  d: number;
  ele: number;
}

/** Fenêtre (m) sur laquelle la pente est calculée, pour lisser le bruit des altitudes. */
export const SLOPE_WINDOW_M = 100;

/** Altitude à la distance `d`, par interpolation linéaire (points triés par distance). */
export function eleAt(points: ElePoint[], d: number): number {
  const n = points.length;
  if (n === 0) return NaN;
  if (d <= points[0].d) return points[0].ele;
  if (d >= points[n - 1].d) return points[n - 1].ele;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].d <= d) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const span = b.d - a.d;
  return span > 0 ? a.ele + ((d - a.d) / span) * (b.ele - a.ele) : a.ele;
}

/** Pente (%) entre deux distances. Positive = montée dans le sens du tracé. */
export function slopeBetween(points: ElePoint[], d0: number, d1: number): number {
  const run = d1 - d0;
  if (!(run > 0)) return 0;
  return ((eleAt(points, d1) - eleAt(points, d0)) / run) * 100;
}

/** Pente (%) au point `d`, sur une fenêtre centrée de `window` m (réduite aux extrémités). */
export function slopeAt(points: ElePoint[], d: number, window = SLOPE_WINDOW_M): number {
  if (points.length < 2) return 0;
  const total = points[points.length - 1].d;
  const half = Math.min(window, total) / 2;
  let d0 = d - half;
  let d1 = d + half;
  if (d0 < 0) [d0, d1] = [0, Math.min(total, 2 * half)];
  if (d1 > total) [d0, d1] = [Math.max(0, total - 2 * half), total];
  return slopeBetween(points, d0, d1);
}

/** Pentes maximales en montée et en descente (valeurs positives, %), sur une fenêtre glissante. */
export function maxSlopes(points: ElePoint[], window = SLOPE_WINDOW_M): { up: number; down: number } {
  if (points.length < 2) return { up: 0, down: 0 };
  const total = points[points.length - 1].d;
  const w = Math.min(window, total);
  if (w <= 0) return { up: 0, down: 0 };
  // Pas d'échantillonnage : 10 m, élargi pour les très longs tracés (≤ 5000 évaluations).
  const step = Math.max(10, total / 5000);
  let up = 0;
  let down = 0;
  for (let d0 = 0; d0 + w <= total + 1e-6; d0 += step) {
    const s = slopeBetween(points, d0, d0 + w);
    if (s > up) up = s;
    if (-s > down) down = -s;
  }
  return { up, down };
}

/** Classes de pente (valeur absolue), de la plus douce à la plus raide. */
export const SLOPE_CLASSES = [
  { max: 5, label: '< 5', color: '#7cb342' },
  { max: 10, label: '5–10', color: '#fdd835' },
  { max: 15, label: '10–15', color: '#fb8c00' },
  { max: 25, label: '15–25', color: '#e53935' },
  { max: Infinity, label: '> 25', color: '#6a1b9a' },
] as const;

export function slopeClassIndex(slopePct: number): number {
  const a = Math.abs(slopePct);
  return SLOPE_CLASSES.findIndex((c) => a < c.max);
}

export interface SlopeRun {
  d0: number;
  d1: number;
  classIndex: number;
}

/**
 * Découpe le profil en tronçons de `step` m, chacun classé selon sa pente,
 * puis fusionne les tronçons consécutifs de même classe.
 */
export function slopeRuns(points: ElePoint[], step: number, window = SLOPE_WINDOW_M): SlopeRun[] {
  if (points.length < 2 || !(step > 0)) return [];
  const total = points[points.length - 1].d;
  const runs: SlopeRun[] = [];
  for (let d0 = 0; d0 < total; d0 += step) {
    const d1 = Math.min(total, d0 + step);
    const classIndex = slopeClassIndex(slopeAt(points, (d0 + d1) / 2, Math.max(window, d1 - d0)));
    const last = runs[runs.length - 1];
    if (last && last.classIndex === classIndex) last.d1 = d1;
    else runs.push({ d0, d1, classIndex });
  }
  return runs;
}

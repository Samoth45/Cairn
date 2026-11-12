import type { ProfilePoint } from './stats';

export type PointRole = 'start' | 'summit' | 'lowest';

/** Point d'échantillonnage météo le long d'un tracé. */
export interface WeatherPoint {
  lat: number;
  lon: number;
  ele: number;
  /** Distance depuis le départ (m). */
  d: number;
  /** Rôles portés par ce point (plusieurs si des points proches ont été fusionnés). */
  roles: PointRole[];
}

/** Au plus 8 points par tracé. */
export const MAX_WEATHER_POINTS = 8;
/** Écart d'altitude visé entre points intermédiaires (m). */
export const WEATHER_STEP_M = 400;
/** Deux points à moins de cet écart d'altitude sont fusionnés (m). */
export const WEATHER_MERGE_M = 200;

type ElePoint = ProfilePoint & { ele: number };

/**
 * Choisit les points de prévision : sommet, départ, point le plus bas (s'il diffère
 * nettement du départ) et des points intermédiaires environ tous les 400 m de
 * dénivelé. Les points à moins de 200 m d'altitude d'un point déjà retenu sont
 * fusionnés avec lui. Résultat trié du plus haut au plus bas.
 */
export function selectWeatherPoints(profile: ProfilePoint[]): WeatherPoint[] {
  const pts = profile.filter((p): p is ElePoint => p.ele !== null);
  if (pts.length === 0) return [];

  let summitIdx = 0;
  let lowestIdx = 0;
  pts.forEach((p, i) => {
    if (p.ele > pts[summitIdx].ele) summitIdx = i;
    if (p.ele < pts[lowestIdx].ele) lowestIdx = i;
  });
  const start = pts[0];
  const summit = pts[summitIdx];
  const lowest = pts[lowestIdx];

  const candidates: Array<{ p: ElePoint; roles: PointRole[] }> = [
    { p: summit, roles: ['summit'] },
    { p: start, roles: ['start'] },
  ];
  if (start.ele - lowest.ele >= WEATHER_MERGE_M) candidates.push({ p: lowest, roles: ['lowest'] });

  // Points intermédiaires : pas élargi si besoin pour rester sous la limite de 8 points.
  const range = summit.ele - lowest.ele;
  const step = Math.max(WEATHER_STEP_M, range / (MAX_WEATHER_POINTS - 1));
  for (let level = lowest.ele + step; level < summit.ele; level += step) {
    candidates.push({ p: closestToLevel(pts, level, summitIdx), roles: [] });
  }

  const kept: WeatherPoint[] = [];
  for (const c of candidates) {
    const near = kept.find((k) => Math.abs(k.ele - c.p.ele) < WEATHER_MERGE_M);
    if (near) {
      for (const r of c.roles) if (!near.roles.includes(r)) near.roles.push(r);
    } else if (kept.length < MAX_WEATHER_POINTS) {
      kept.push({ lat: c.p.lat, lon: c.p.lon, ele: c.p.ele, d: c.p.d, roles: [...c.roles] });
    }
  }
  return kept.sort((a, b) => b.ele - a.ele);
}

/**
 * Point dont l'altitude est la plus proche de `level`, de préférence sur la montée
 * (entre le départ et le sommet), là où le randonneur passera en premier.
 */
function closestToLevel(pts: ElePoint[], level: number, summitIdx: number): ElePoint {
  const best = (from: number, to: number) => {
    let b = pts[from];
    for (let i = from; i <= to; i++) if (Math.abs(pts[i].ele - level) < Math.abs(b.ele - level)) b = pts[i];
    return b;
  };
  const onClimb = best(0, summitIdx);
  return Math.abs(onClimb.ele - level) <= 50 ? onClimb : best(0, pts.length - 1);
}

/** Clé identifiant un jeu de points (pour invalider le cache si les points changent). */
export function weatherPointsKey(points: WeatherPoint[]): string {
  return points.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)},${Math.round(p.ele)}`).join(';');
}

const ROLE_LABELS: Record<PointRole, string> = { summit: 'Sommet', start: 'Départ', lowest: 'Point bas' };

/** Libellé : « Sommet · Départ » (ordre fixe), ou chaîne vide pour un point intermédiaire. */
export function rolesLabel(roles: PointRole[]): string {
  return (['summit', 'start', 'lowest'] as const)
    .filter((r) => roles.includes(r))
    .map((r) => ROLE_LABELS[r])
    .join(' · ');
}

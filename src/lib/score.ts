import type { ScoreWeights } from '../types';
import type { ForecastData } from '../services/weather';
import type { ProfilePoint } from './stats';
import type { WeatherPoint } from './weatherPoints';
import type { WeatherSample } from './trackForecast';
import { isThunderstorm } from './wmo';
import { summitIndex } from './weatherTable';
import { formatPercent, formatPrecip, formatTemp, formatWind } from './format';

export type PenaltyKind = keyof ScoreWeights;

export interface Penalty {
  kind: PenaltyKind;
  /** Gravité entre 0 (aucune gêne) et 1 (pénalité maximale). */
  severity: number;
  /** Points retirés au score : gravité × poids. */
  points: number;
  /** Valeur constatée, en clair (« 3,2 mm », « 65 km/h »…). */
  detail: string;
}

export interface DayScore {
  /** Score de 0 à 100 (100 : conditions idéales). */
  score: number;
  penalties: Penalty[];
  /** Part de la fenêtre de rando couverte par la prévision (0 à 1). */
  coverage: number;
}

export const PENALTY_LABELS: Record<PenaltyKind, string> = {
  rain: 'Pluie',
  storm: 'Orage',
  gusts: 'Rafales au sommet',
  clouds: 'Nébulosité au sommet',
  cold: 'Froid extrême',
};

export const PENALTY_ICONS: Record<PenaltyKind, string> = {
  rain: '☔',
  storm: '⛈️',
  gusts: '💨',
  clouds: '☁️',
  cold: '🥶',
};

/** Pas d'échantillonnage le long de la rando (heures de marche). */
const SAMPLE_STEP_H = 0.25;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/*
 * Gravités (0 → 1), choisies pour rester lisibles :
 * - pluie : cumul sur la rando, 0 mm → 0, ≥ 5 mm → 1 ; ou risque moyen de pluie × 0,6 si plus fort ;
 * - orage : 1 si orage prévu pendant la rando, 0,5 dans les 2 h avant ou après ;
 * - rafales au sommet : max sur la fenêtre, ≤ 30 km/h → 0, ≥ 70 km/h → 1 ;
 * - nébulosité au sommet : moyenne sur la fenêtre, ≤ 50 % → 0, 100 % → 1 ;
 * - froid extrême : ressenti minimal le long du parcours, ≥ −5 °C → 0, ≤ −20 °C → 1.
 */
export const rainSeverity = (totalMm: number, meanProbability: number | null) =>
  Math.max(clamp01(totalMm / 5), meanProbability === null ? 0 : (clamp01(meanProbability / 100) * 0.6));
export const gustSeverity = (maxGust: number) => clamp01((maxGust - 30) / 40);
export const cloudSeverity = (meanCloud: number) => clamp01((meanCloud - 50) / 50);
export const coldSeverity = (minApparent: number) => clamp01((-5 - minApparent) / 15);

export interface ScoreInput {
  data: ForecastData;
  points: WeatherPoint[];
  profile: ProfilePoint[];
  /** Heures écoulées depuis le départ en chaque point du profil (croissant). */
  passage: number[];
  sample: (ele: number, f: number) => WeatherSample | null;
  /** Indice horaire fractionnaire du départ dans `data.times`. */
  startIndex: number;
  durationHours: number;
}

/** Indice du profil atteint après `t` heures de marche (recherche dichotomique). */
function profileIndexAt(passage: number[], t: number): number {
  let lo = 0;
  let hi = passage.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (passage[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Score d'une journée pour un tracé, sur la fenêtre de rando (départ + durée estimée).
 * Pluie, orage et froid : météo à l'endroit où l'on se trouve à chaque instant (même calcul
 * que la coloration du tracé). Rafales et nébulosité : série du point « Sommet ».
 * Renvoie null si la prévision ne couvre aucune partie de la rando.
 */
export function computeDayScore(input: ScoreInput, weights: ScoreWeights): DayScore | null {
  const { data, points, profile, passage, sample, startIndex, durationHours } = input;
  if (profile.length === 0 || points.length === 0 || !(durationHours > 0)) return null;

  // 1. Le long du parcours, toutes les 15 min de marche.
  const steps = Math.max(1, Math.ceil(durationHours / SAMPLE_STEP_H));
  let covered = 0;
  let rainMm = 0;
  let probSum = 0;
  let probN = 0;
  let minApparent = Infinity;
  for (let k = 0; k <= steps; k++) {
    const t = Math.min(durationHours, k * SAMPLE_STEP_H);
    const p = profile[profileIndexAt(passage, t)];
    if (p.ele === null) continue;
    const s = sample(p.ele, startIndex + t);
    if (!s) continue;
    covered++;
    // Chaque échantillon représente 15 min (moitié pour le premier et le dernier).
    const weight = k === 0 || k === steps ? SAMPLE_STEP_H / 2 : SAMPLE_STEP_H;
    if (s.precipitation != null) rainMm += s.precipitation * weight;
    if (s.probability != null) {
      probSum += s.probability;
      probN++;
    }
    if (s.apparent != null && s.apparent < minApparent) minApparent = s.apparent;
  }
  if (covered === 0) return null;

  // 2. Heures entières de la fenêtre (pour l'orage et le sommet).
  const last = data.times.length - 1;
  const first = Math.max(0, Math.floor(startIndex));
  const end = Math.min(last, Math.ceil(startIndex + durationHours));
  const top = data.points[summitIndex(points)];
  let gustMax = -Infinity;
  let cloudSum = 0;
  let cloudN = 0;
  for (let i = first; i <= end; i++) {
    const g = top.wind_gusts_10m[i];
    if (g != null && g > gustMax) gustMax = g;
    const c = top.cloud_cover[i];
    if (c != null) {
      cloudSum += c;
      cloudN++;
    }
  }
  const stormAt = (i: number) => i >= 0 && i <= last && data.points.some((s) => isThunderstorm(s.weather_code[i]));
  let storm = 0;
  for (let i = first; i <= end; i++) if (stormAt(i)) storm = 1;
  if (!storm) for (let i = first - 2; i <= end + 2; i++) if (stormAt(i)) storm = 0.5;

  const meanProb = probN ? probSum / probN : null;
  const meanCloud = cloudN ? cloudSum / cloudN : null;
  const raw: Array<[PenaltyKind, number, string]> = [
    ['rain', rainSeverity(rainMm, meanProb), `${formatPrecip(rainMm)} sur la rando, risque moyen ${formatPercent(meanProb)}`],
    ['storm', storm, storm === 1 ? 'orage prévu pendant la rando' : storm ? 'orage prévu peu avant ou après' : 'pas d’orage'],
    ['gusts', Number.isFinite(gustMax) ? gustSeverity(gustMax) : 0, `jusqu'à ${formatWind(Number.isFinite(gustMax) ? gustMax : null)}`],
    ['clouds', meanCloud === null ? 0 : cloudSeverity(meanCloud), `${formatPercent(meanCloud)} en moyenne`],
    ['cold', Number.isFinite(minApparent) ? coldSeverity(minApparent) : 0, `ressenti minimal ${formatTemp(Number.isFinite(minApparent) ? minApparent : null)}`],
  ];
  const penalties = raw.map(([kind, severity, detail]) => ({ kind, severity, points: severity * weights[kind], detail }));
  const total = penalties.reduce((sum, p) => sum + p.points, 0);
  return {
    score: Math.round(Math.max(0, Math.min(100, 100 - total))),
    penalties,
    coverage: covered / (steps + 1),
  };
}

/** Fond (pastel) et texte pour un score : rouge (0) → orange → vert (100). */
export function scoreColor(score: number | null): { bg: string; fg: string } {
  if (score === null) return { bg: 'var(--nodata)', fg: 'var(--muted-foreground)' };
  const hue = Math.round((Math.max(0, Math.min(100, score)) / 100) * 125);
  return { bg: `hsl(${hue}, 68%, 82%)`, fg: `hsl(${hue}, 60%, 22%)` };
}

/**
 * Fiabilité de la prévision selon l'échéance (0 = aujourd'hui) : bonne jusqu'à J+2,
 * moyenne à J+3 et J+4, faible au-delà (cases atténuées).
 */
export function reliability(dayOffset: number): 'good' | 'medium' | 'low' {
  return dayOffset <= 2 ? 'good' : dayOffset <= 4 ? 'medium' : 'low';
}

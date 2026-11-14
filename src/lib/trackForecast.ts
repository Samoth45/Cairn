import type { DinSpeeds } from '../types';
import type { ForecastData, PointSeries } from '../services/weather';
import type { ProfilePoint } from './stats';
import type { WeatherPoint } from './weatherPoints';
import { eleAt, type ElePoint } from './slope';
import { tempColor } from './weatherTable';
import { haversine } from './geo';

/** Variable utilisée pour colorer le tracé. */
export type ColorVariable = 'temperature' | 'gusts' | 'precipitation';
export type TrackColoring = 'none' | ColorVariable;

export const COLORING_LABELS: Record<TrackColoring, string> = {
  none: 'Aucune',
  temperature: 'Température',
  gusts: 'Rafales',
  precipitation: 'Pluie',
};

// ---------- Heures de passage (DIN 33466 tronçon par tronçon) ----------

/** Longueur des tronçons du calcul DIN (m) : assez court pour suivre le relief, assez long pour lisser le bruit. */
export const PASSAGE_STEP_M = 100;

/**
 * Temps écoulé depuis le départ (heures) en chaque point du profil.
 * La durée DIN est calculée par tronçons de 100 m (max(horizontal, vertical) + moitié du plus
 * petit), puis l'ensemble est recalé sur `totalHours` (durée DIN du tracé entier, celle des
 * statistiques) pour que l'heure d'arrivée corresponde à la durée affichée.
 */
export function passageHours(profile: ProfilePoint[], din: DinSpeeds, totalHours: number | null): number[] {
  if (profile.length === 0) return [];
  const total = profile[profile.length - 1].d;
  const elePts = profile.filter((p): p is ProfilePoint & { ele: number } => p.ele !== null) as ElePoint[];
  const hasEle = elePts.length >= 2;

  // Temps cumulé aux bornes des tronçons.
  const bounds: number[] = [0];
  const cumul: number[] = [0];
  for (let d0 = 0; d0 < total; d0 += PASSAGE_STEP_M) {
    const d1 = Math.min(total, d0 + PASSAGE_STEP_M);
    const horizontal = (d1 - d0) / 1000 / din.flatKmh;
    let vertical = 0;
    if (hasEle) {
      const dh = eleAt(elePts, d1) - eleAt(elePts, d0);
      vertical = dh > 0 ? dh / din.ascentMh : -dh / din.descentMh;
    }
    bounds.push(d1);
    cumul.push(cumul[cumul.length - 1] + Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2);
  }
  const raw = cumul[cumul.length - 1];
  const scale = totalHours !== null && totalHours > 0 && raw > 0 ? totalHours / raw : 1;

  // Interpolation au niveau de chaque point du profil.
  let k = 0;
  return profile.map((p) => {
    while (k < bounds.length - 2 && bounds[k + 1] < p.d) k++;
    const span = bounds[k + 1] - bounds[k];
    const t = span > 0 ? Math.min(1, Math.max(0, (p.d - bounds[k]) / span)) : 0;
    return (cumul[k] + t * (cumul[k + 1] - cumul[k])) * scale;
  });
}

// ---------- Temps (indices horaires fractionnaires) ----------

/** « 08:30 » → 510 minutes ; null si invalide. */
export function parseClock(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** 510 → « 08:30 » ; au-delà de minuit : « 01:10 (+1 j) ». */
export function formatClockMinutes(minutes: number): string {
  const m = Math.round(minutes);
  const days = Math.floor(m / 1440);
  const inDay = ((m % 1440) + 1440) % 1440;
  const s = `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
  return days > 0 ? `${s} (+${days} j)` : s;
}

/**
 * Indice horaire fractionnaire du départ dans les séries de la prévision : le jour `day`
 * à `minutes` (heure de Paris, comme les séries). null si le jour n'est pas couvert.
 */
export function departureIndex(times: string[], day: string, minutes: number): number | null {
  const midnight = times.indexOf(`${day}T00:00`);
  if (midnight < 0) return null;
  return midnight + minutes / 60;
}

// ---------- Météo à une altitude et à un instant donnés ----------

export interface WeatherSample {
  temperature: number | null;
  apparent: number | null;
  wind: number | null;
  gusts: number | null;
  direction: number | null;
  precipitation: number | null;
  probability: number | null;
  code: number | null;
}

type NumericVar = 'temperature_2m' | 'apparent_temperature' | 'wind_speed_10m' | 'wind_gusts_10m' | 'precipitation' | 'precipitation_probability';

/** Valeur interpolée linéairement dans le temps (indice fractionnaire). */
function atTime(series: Array<number | null>, f: number): number | null {
  const i0 = Math.floor(f);
  const t = f - i0;
  const a = series[i0];
  const b = series[i0 + 1];
  if (t === 0 || b == null) return a ?? null;
  if (a == null) return b;
  return a + t * (b - a);
}

/**
 * Prépare un échantillonneur : météo à l'altitude `ele` et à l'indice horaire fractionnaire `f`.
 * Interpolation linéaire en altitude entre les deux points de prévision qui encadrent `ele`
 * (valeur du point le plus proche au-delà des extrêmes) et linéaire dans le temps.
 * Renvoie null hors de la période couverte par la prévision.
 */
export function makeWeatherSampler(data: ForecastData, points: WeatherPoint[]) {
  const order = points.map((p, k) => ({ ele: p.ele, s: data.points[k] })).sort((a, b) => a.ele - b.ele);
  const n = data.times.length;

  return (ele: number, f: number): WeatherSample | null => {
    if (order.length === 0 || !(f >= 0) || f > n - 1) return null;
    let lo = order[0];
    let hi = order[order.length - 1];
    if (ele <= lo.ele) hi = lo;
    else if (ele >= hi.ele) lo = hi;
    else {
      for (let k = 1; k < order.length; k++) {
        if (order[k].ele >= ele) {
          lo = order[k - 1];
          hi = order[k];
          break;
        }
      }
    }
    const w = hi.ele > lo.ele ? (ele - lo.ele) / (hi.ele - lo.ele) : 0;
    const v = (key: NumericVar) => {
      const a = atTime(lo.s[key], f);
      const b = atTime(hi.s[key], f);
      if (a == null) return b;
      if (b == null) return a;
      return a + w * (b - a);
    };
    // Direction et code météo : point et heure les plus proches (pas d'interpolation d'angles ni de codes).
    const nearest: PointSeries = w < 0.5 ? lo.s : hi.s;
    const hour = Math.min(n - 1, Math.round(f));
    return {
      temperature: v('temperature_2m'),
      apparent: v('apparent_temperature'),
      wind: v('wind_speed_10m'),
      gusts: v('wind_gusts_10m'),
      precipitation: v('precipitation'),
      probability: v('precipitation_probability'),
      direction: nearest.wind_direction_10m[hour],
      code: nearest.weather_code[hour],
    };
  };
}

// ---------- Couleurs ----------

export const NO_DATA_COLOR = '#9e9e9e';

interface ColorClass {
  max: number;
  label: string;
  color: string;
}

export const GUST_CLASSES: ColorClass[] = [
  { max: 20, label: '< 20', color: '#43a047' },
  { max: 35, label: '20–35', color: '#c0ca33' },
  { max: 50, label: '35–50', color: '#fdd835' },
  { max: 70, label: '50–70', color: '#fb8c00' },
  { max: 90, label: '70–90', color: '#e53935' },
  { max: Infinity, label: '> 90', color: '#6a1b9a' },
];

export const PRECIP_CLASSES: ColorClass[] = [
  { max: 0.1, label: 'sec', color: '#7cb342' },
  { max: 0.5, label: '< 0,5', color: '#81d4fa' },
  { max: 1, label: '0,5–1', color: '#29b6f6' },
  { max: 2, label: '1–2', color: '#1e88e5' },
  { max: 5, label: '2–5', color: '#3949ab' },
  { max: Infinity, label: '> 5', color: '#6a1b9a' },
];

/** Températures repères de la légende (même échelle que le tableau météo). */
export const TEMP_STEPS = [-10, -5, 0, 5, 10, 15, 20, 25, 30];

export const LEGENDS: Record<ColorVariable, { unit: string; items: Array<{ label: string; color: string }> }> = {
  temperature: { unit: '°C', items: TEMP_STEPS.map((t) => ({ label: String(t).replace('-', '−'), color: tempColor(t).bg })) },
  gusts: { unit: 'km/h', items: GUST_CLASSES.map((c) => ({ label: c.label, color: c.color })) },
  precipitation: { unit: 'mm/h', items: PRECIP_CLASSES.map((c) => ({ label: c.label, color: c.color })) },
};

function classOf(classes: ColorClass[], v: number): number {
  const i = classes.findIndex((c) => v < c.max);
  return i < 0 ? classes.length - 1 : i;
}

/**
 * Clé de regroupement et couleur d'un échantillon : les tronçons consécutifs de même clé
 * sont fusionnés en une seule ligne. Température : pas de 1 °C ; rafales et pluie : classes.
 */
export function colorOf(variable: ColorVariable, s: WeatherSample | null): { key: string; color: string } {
  const v = s ? (variable === 'temperature' ? s.temperature : variable === 'gusts' ? s.gusts : s.precipitation) : null;
  if (v == null) return { key: 'none', color: NO_DATA_COLOR };
  if (variable === 'temperature') {
    const r = Math.round(v);
    return { key: `t${r}`, color: tempColor(r).bg };
  }
  const classes = variable === 'gusts' ? GUST_CLASSES : PRECIP_CLASSES;
  const i = classOf(classes, v);
  return { key: `${variable}${i}`, color: classes[i].color };
}

// ---------- Tronçons colorés ----------

export interface ColoredRun {
  positions: Array<[number, number]>;
  color: string;
}

/** Écart maximal (m) entre deux points colorés : les tracés peu denses sont subdivisés. */
const MAX_PIECE_M = 100;

/**
 * Découpe le tracé en lignes de couleur homogène selon la prévision à l'heure de passage.
 * Chaque morceau prend la couleur de la météo en son milieu (altitude et heure interpolées).
 * Les lignes ne relient jamais deux segments GPX différents.
 */
export function coloredRuns(
  profile: ProfilePoint[],
  hours: number[],
  sample: (ele: number, f: number) => WeatherSample | null,
  startIndex: number,
  variable: ColorVariable,
): ColoredRun[] {
  const runs: ColoredRun[] = [];
  let currentKey = '';
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (a.seg !== b.seg) {
      currentKey = ''; // nouveau segment : nouvelle ligne
      continue;
    }
    const len = haversine(a.lat, a.lon, b.lat, b.lon);
    const pieces = Math.max(1, Math.ceil(len / MAX_PIECE_M));
    for (let k = 0; k < pieces; k++) {
      const t0 = k / pieces;
      const t1 = (k + 1) / pieces;
      const tm = (t0 + t1) / 2;
      const lerp = (x: number, y: number, t: number) => x + t * (y - x);
      const ele = a.ele !== null && b.ele !== null ? lerp(a.ele, b.ele, tm) : (a.ele ?? b.ele);
      const f = startIndex + lerp(hours[i - 1], hours[i], tm);
      const { key, color } = colorOf(variable, ele === null ? null : sample(ele, f));
      const p0: [number, number] = [lerp(a.lat, b.lat, t0), lerp(a.lon, b.lon, t0)];
      const p1: [number, number] = [lerp(a.lat, b.lat, t1), lerp(a.lon, b.lon, t1)];
      if (key === currentKey) {
        runs[runs.length - 1].positions.push(p1);
      } else {
        runs.push({ positions: [p0, p1], color });
        currentKey = key;
      }
    }
  }
  return runs;
}

/** Indice du point du profil le plus proche d'une position (approximation équirectangulaire). */
export function nearestProfileIndexByLatLng(profile: ProfilePoint[], lat: number, lon: number): number {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < profile.length; i++) {
    const dy = profile[i].lat - lat;
    const dx = (profile[i].lon - lon) * k;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

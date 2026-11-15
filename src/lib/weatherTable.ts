import type { PointSeries } from '../services/weather';
import type { WeatherPoint } from './weatherPoints';
import { isThunderstorm } from './wmo';
import { formatMeters, formatTemp, formatWind } from './format';

/** Plage horaire du tableau (heures locales incluses). */
export const TABLE_FIRST_HOUR = 6;
export const TABLE_LAST_HOUR = 21;

/** Seuils d'alerte. */
export const GUST_ALERT_KMH = 50;
export const COLD_ALERT_C = -5;
export const RAIN_ICON_MM = 0.2;
/** Écart minimal (°C) pour parler d'inversion (évite les faux positifs à quelques dixièmes près). */
export const INVERSION_MARGIN_C = 1;

/** Jours présents dans la prévision (« 2026-11-12 »), dans l'ordre. */
export function forecastDays(times: string[]): string[] {
  const days: string[] = [];
  for (const t of times) {
    const d = t.slice(0, 10);
    if (days[days.length - 1] !== d) days.push(d);
  }
  return days;
}

/** Indices des heures d'un jour comprises entre `from` h et `to` h. */
export function dayHourIndices(times: string[], day: string, from = TABLE_FIRST_HOUR, to = TABLE_LAST_HOUR): number[] {
  const out: number[] = [];
  times.forEach((t, i) => {
    if (!t.startsWith(day)) return;
    const h = Number(t.slice(11, 13));
    if (h >= from && h <= to) out.push(i);
  });
  return out;
}

/** Heure (0–23) d'un horodatage « 2026-11-12T14:00 ». */
export const hourOf = (time: string) => Number(time.slice(11, 13));

/**
 * Indice à sélectionner quand on choisit un autre jour : même heure que l'heure actuelle
 * si elle est dans la plage du tableau, sinon midi.
 */
export function indexForDay(times: string[], day: string, currentIndex: number | null): number {
  const h = currentIndex !== null ? hourOf(times[currentIndex]) : 12;
  const target = h >= TABLE_FIRST_HOUR && h <= TABLE_LAST_HOUR ? h : 12;
  const exact = times.findIndex((t) => t.startsWith(day) && hourOf(t) === target);
  return exact >= 0 ? exact : Math.max(0, times.findIndex((t) => t.startsWith(day)));
}

// ---------- Couleurs de température (bleu → rouge, centrée sur 0 °C) ----------

const TEMP_STOPS: Array<[number, [number, number, number]]> = [
  [-25, [36, 52, 140]],
  [-15, [52, 98, 190]],
  [-7, [104, 156, 222]],
  [-2, [186, 214, 242]],
  [0, [240, 240, 236]],
  [3, [252, 232, 178]],
  [10, [250, 190, 112]],
  [18, [238, 128, 72]],
  [26, [214, 64, 50]],
  [35, [140, 20, 30]],
];

/** Couleur de fond et couleur de texte lisible pour une température. */
export function tempColor(t: number | null | undefined): { bg: string; fg: string } {
  if (t === null || t === undefined || !Number.isFinite(t)) return { bg: 'var(--nodata-bg)', fg: 'var(--muted)' };
  let rgb = TEMP_STOPS[TEMP_STOPS.length - 1][1];
  if (t <= TEMP_STOPS[0][0]) rgb = TEMP_STOPS[0][1];
  for (let k = 1; k < TEMP_STOPS.length; k++) {
    const [t1, c1] = TEMP_STOPS[k];
    if (t <= t1) {
      const [t0, c0] = TEMP_STOPS[k - 1];
      const f = Math.max(0, (t - t0) / (t1 - t0));
      rgb = [0, 1, 2].map((i) => Math.round(c0[i] + f * (c1[i] - c0[i]))) as [number, number, number];
      break;
    }
  }
  // Luminance relative approchée : texte foncé sur fond clair, clair sur fond foncé.
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return { bg: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`, fg: lum > 0.55 ? '#1d2327' : '#ffffff' };
}

/** Températures repères de la légende. */
export const TEMP_LEGEND = [-15, -10, -5, 0, 5, 10, 15, 20, 25, 30];

// ---------- Inversion de température ----------

export interface Inversion {
  /** Température en altitude et son libellé (« 850 hPa ≈ 1 500 m »). */
  upperTemp: number;
  upperLabel: string;
  /** Température plus basse en dessous et son libellé (« 1 250 m (au sol) » ou « 850 hPa »). */
  lowerTemp: number;
  lowerLabel: string;
  /** Écart en °C (positif : plus chaud en haut). */
  diff: number;
}

const LEVEL_850 = '850 hPa (≈ 1 500 m)';
const LEVEL_700 = '700 hPa (≈ 3 000 m)';

/**
 * Inversion probable à l'heure `i` : l'air en altitude (850 hPa ≈ 1 500 m, 700 hPa ≈ 3 000 m)
 * est plus chaud que l'air au sol à un point situé nettement en dessous, ou 700 hPa est plus
 * chaud que 850 hPa. Renvoie la plus marquée, ou null.
 */
export function detectInversion(series: PointSeries[], points: WeatherPoint[], i: number): Inversion | null {
  const candidates: Inversion[] = [];

  points.forEach((p, k) => {
    const s = series[k];
    const t2m = s?.temperature_2m[i];
    if (t2m == null) return;
    // Chaque point est comparé aux niveaux de pression de sa propre maille.
    const t850 = s.temperature_850hPa[i];
    const t700 = s.temperature_700hPa[i];
    const ground = `${formatMeters(p.ele)} (au sol)`;
    // On ne compare qu'à des points nettement sous le niveau de pression.
    if (t850 != null && p.ele <= 1300 && t850 - t2m >= INVERSION_MARGIN_C) {
      candidates.push({ upperTemp: t850, upperLabel: LEVEL_850, lowerTemp: t2m, lowerLabel: ground, diff: t850 - t2m });
    }
    if (t700 != null && p.ele <= 2700 && t700 - t2m >= INVERSION_MARGIN_C) {
      candidates.push({ upperTemp: t700, upperLabel: LEVEL_700, lowerTemp: t2m, lowerLabel: ground, diff: t700 - t2m });
    }
    if (t850 != null && t700 != null && t700 - t850 >= INVERSION_MARGIN_C) {
      candidates.push({ upperTemp: t700, upperLabel: LEVEL_700, lowerTemp: t850, lowerLabel: LEVEL_850, diff: t700 - t850 });
    }
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.diff > a.diff ? b : a));
}

export function inversionExplanation(inv: Inversion): string {
  return (
    `Inversion de température probable : l'air est plus chaud en altitude (${formatTemp(inv.upperTemp)} à ${inv.upperLabel}) ` +
    `qu'en dessous (${formatTemp(inv.lowerTemp)} à ${inv.lowerLabel}). L'air froid stagne dans les vallées ` +
    `(grisaille, brouillard, gel) tandis qu'au-dessus il fait souvent plus doux et ensoleillé.`
  );
}

// ---------- Alertes ----------

export type AlertKind = 'gusts' | 'storm' | 'cold' | 'freezing';

export interface WeatherAlert {
  kind: AlertKind;
  message: string;
}

/** « 8 h », « 8 h, 14 h–16 h » (heures consécutives regroupées). */
export function formatHourRanges(hours: number[]): string {
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let k = 0; k < sorted.length; k++) {
    const start = sorted[k];
    while (k + 1 < sorted.length && sorted[k + 1] === sorted[k] + 1) k++;
    parts.push(start === sorted[k] ? `${start} h` : `${start} h–${sorted[k]} h`);
  }
  return parts.join(', ');
}

/** Indice du point « Sommet » (le plus haut sinon). */
export function summitIndex(points: WeatherPoint[]): number {
  const i = points.findIndex((p) => p.roles.includes('summit'));
  if (i >= 0) return i;
  return points.reduce((best, p, k) => (p.ele > points[best].ele ? k : best), 0);
}

/**
 * Alertes sur les heures `indices` : rafales > 50 km/h au sommet, orage (WMO 95–99),
 * ressenti < −5 °C, isotherme 0 °C sous le point culminant.
 */
export function computeAlerts(series: PointSeries[], points: WeatherPoint[], times: string[], indices: number[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  if (points.length === 0 || indices.length === 0) return alerts;
  const top = summitIndex(points);
  const summitSeries = series[top];
  const summitEle = points[top].ele;

  // Rafales au sommet.
  let gustMax = -Infinity;
  let gustHour = 0;
  const gustHours: number[] = [];
  for (const i of indices) {
    const g = summitSeries.wind_gusts_10m[i];
    if (g == null) continue;
    if (g > GUST_ALERT_KMH) gustHours.push(hourOf(times[i]));
    if (g > gustMax) {
      gustMax = g;
      gustHour = hourOf(times[i]);
    }
  }
  if (gustHours.length) {
    alerts.push({
      kind: 'gusts',
      message: `Rafales jusqu'à ${formatWind(gustMax)} au sommet (${gustHour} h) ; > ${GUST_ALERT_KMH} km/h : ${formatHourRanges(gustHours)}`,
    });
  }

  // Orage, quel que soit le point.
  const stormHours = indices.filter((i) => series.some((s) => isThunderstorm(s.weather_code[i]))).map((i) => hourOf(times[i]));
  if (stormHours.length) alerts.push({ kind: 'storm', message: `Orage prévu : ${formatHourRanges(stormHours)}` });

  // Ressenti très froid.
  let coldMin = Infinity;
  let coldAt = '';
  for (const i of indices) {
    series.forEach((s, k) => {
      const a = s.apparent_temperature[i];
      if (a != null && a < coldMin) {
        coldMin = a;
        coldAt = `${formatMeters(points[k].ele)}, ${hourOf(times[i])} h`;
      }
    });
  }
  if (coldMin < COLD_ALERT_C) alerts.push({ kind: 'cold', message: `Ressenti jusqu'à ${formatTemp(coldMin)} (${coldAt})` });

  // Isotherme 0 °C sous le point culminant.
  let isoMin = Infinity;
  let isoHour = 0;
  const isoHours: number[] = [];
  for (const i of indices) {
    const f = summitSeries.freezing_level_height[i];
    if (f == null) continue;
    if (f < summitEle) isoHours.push(hourOf(times[i]));
    if (f < isoMin) {
      isoMin = f;
      isoHour = hourOf(times[i]);
    }
  }
  if (isoHours.length) {
    alerts.push({
      kind: 'freezing',
      message: `Isotherme 0 °C sous le sommet (${formatMeters(summitEle)}) : jusqu'à ${formatMeters(isoMin)} à ${isoHour} h — neige ou verglas possibles (${formatHourRanges(isoHours)})`,
    });
  }
  return alerts;
}

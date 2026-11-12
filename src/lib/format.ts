const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf4 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const DASH = '–';

export function formatKm(meters: number): string {
  return `${meters < 10000 ? nf1.format(meters / 1000) : nf0.format(meters / 1000)} km`;
}

export function formatMeters(m: number | null | undefined): string {
  return m === null || m === undefined || !Number.isFinite(m) ? DASH : `${nf0.format(Math.round(m))} m`;
}

/** 5,25 h → « 5 h 15 », 0,5 h → « 30 min ». */
export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours)) return DASH;
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

export function formatCoords(lat: number, lon: number): string {
  return `${nf4.format(Math.abs(lat))}° ${lat >= 0 ? 'N' : 'S'}, ${nf4.format(Math.abs(lon))}° ${lon >= 0 ? 'E' : 'O'}`;
}

/** Pente en % avec le sens : « ↗ 12 % », « ↘ 8 % », « → 0 % ». */
export function formatSlope(pct: number | null | undefined, withArrow = true): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return DASH;
  const r = Math.round(pct);
  const arrow = !withArrow ? '' : r > 0 ? '↗ ' : r < 0 ? '↘ ' : '→ ';
  return `${arrow}${nf0.format(Math.abs(r))} %`;
}

export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n);
}

import { parisHourKey } from './time';

/** Heure choisie dans le panneau météo, liée à une prévision précise (sa clé de cache). */
export interface HourSelection {
  key: string;
  index: number;
}

/** Indice de l'heure courante (Paris) dans les séries, 0 si hors plage. */
export function currentHourIndex(times: string[], now = new Date()): number {
  return Math.max(0, times.indexOf(parisHourKey(now)));
}

/** Indice d'heure à afficher : la sélection si elle concerne cette prévision, sinon l'heure courante. */
export function resolveHourIndex(times: string[], forecastKey: string, selection: HourSelection | null): number {
  if (selection && selection.key === forecastKey) return Math.min(Math.max(selection.index, 0), times.length - 1);
  return currentHourIndex(times);
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** « jeu. 12 nov. · 14 h » à partir de « 2026-11-12T14:00 » (heure locale déjà fournie par l'API). */
export function formatForecastHour(time: string): string {
  const [date, hm] = time.split('T');
  return `${dayFmt.format(new Date(`${date}T00:00Z`))} · ${Number(hm.slice(0, 2))} h`;
}

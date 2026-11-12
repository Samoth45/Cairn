/**
 * Lever et coucher du soleil (équation du lever de soleil, précision ~1 min).
 * Calcul au niveau de l'horizon astronomique (−0,833° : réfraction + rayon du disque) :
 * en montagne, le relief peut masquer le soleil plus tôt (fond de vallée) ou plus tard (crête).
 */

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const JD_UNIX_EPOCH = 2440587.5;
const J2000 = 2451545;

export interface SunTimes {
  /** null si le soleil ne se lève pas (nuit polaire) ou ne se couche pas (jour polaire). */
  sunrise: Date | null;
  sunset: Date | null;
}

/**
 * @param day date civile « 2026-11-12 » (jour à Paris)
 * @param lat latitude (°, nord positif)
 * @param lon longitude (°, est positif)
 */
export function sunTimes(day: string, lat: number, lon: number): SunTimes {
  const [y, m, d] = day.split('-').map(Number);
  const jdNoon = Date.UTC(y, m - 1, d, 12) / DAY_MS + JD_UNIX_EPOCH;
  const n = Math.round(jdNoon - J2000 + 0.0008);
  // Midi solaire moyen (longitude est positive → plus tôt en temps universel).
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = J2000 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);
  if (cosH > 1 || cosH < -1) return { sunrise: null, sunset: null };
  const h = Math.acos(cosH) / RAD / 360;
  const toDate = (jd: number) => new Date((jd - JD_UNIX_EPOCH) * DAY_MS);
  return { sunrise: toDate(jTransit - h), sunset: toDate(jTransit + h) };
}

export interface DaylightInfo extends SunTimes {
  /** Durée du jour en heures. */
  daylightHours: number | null;
  /** Heure de départ au plus tard pour finir avant le coucher (null si inconnue). */
  latestStart: Date | null;
  /** true si la durée de rando dépasse la durée du jour. */
  longerThanDay: boolean;
}

/** Lever/coucher et conseils pour une rando de `durationHours` heures. */
export function daylightInfo(day: string, lat: number, lon: number, durationHours: number | null): DaylightInfo {
  const t = sunTimes(day, lat, lon);
  const daylightHours = t.sunrise && t.sunset ? (t.sunset.getTime() - t.sunrise.getTime()) / 3600000 : null;
  const valid = durationHours !== null && Number.isFinite(durationHours) && durationHours > 0;
  const latestStart = t.sunset && valid ? new Date(t.sunset.getTime() - durationHours * 3600000) : null;
  return {
    ...t,
    daylightHours,
    latestStart,
    longerThanDay: valid && daylightHours !== null && durationHours > daylightHours,
  };
}

/**
 * true si l'heure « 2026-11-12T18:00 » (heure de Paris) tombe de nuit, `sun` étant calculé
 * pour ce même jour. Une heure est « de jour » si son milieu est éclairé.
 */
export function isNightHour(time: string, sun: SunTimes): boolean {
  if (!sun.sunrise || !sun.sunset) return false;
  const mid = Number(time.slice(11, 13)) * 60 + 30;
  return mid < parisMinutes(sun.sunrise) || mid > parisMinutes(sun.sunset);
}

const parisHm = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false });

/** Minutes écoulées depuis minuit, heure de Paris. */
export function parisMinutes(date: Date): number {
  const p = Object.fromEntries(parisHm.formatToParts(date).map((x) => [x.type, x.value]));
  return (Number(p.hour) % 24) * 60 + Number(p.minute);
}

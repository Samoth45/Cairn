const parisParts = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Heure courante à Paris au format des séries Open-Meteo : « 2026-11-12T14:00 ». */
export function parisHourKey(date = new Date()): string {
  const p = Object.fromEntries(parisParts.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:00`;
}

/** `count` jours civils consécutifs à partir de `day` (« 2026-11-12 »), sans fuseau horaire. */
export function nextDays(day: string, count: number): string[] {
  const [y, m, d] = day.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

/** « 14:05 » (heure de Paris). */
export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
}

/** « à l'instant », « il y a 12 min », « il y a 2 h ». */
export function formatAgo(timestamp: number, now = Date.now()): string {
  const min = Math.floor((now - timestamp) / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)} h`;
}

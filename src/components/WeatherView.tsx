import { useMemo, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { WeatherModel } from '../types';
import type { WeatherState } from '../hooks/useWeather';
import type { PointSeries } from '../services/weather';
import { MODEL_LABELS } from '../services/weather';
import { rolesLabel, type WeatherPoint } from '../lib/weatherPoints';
import type { HourSelection } from '../lib/forecast';
import { formatAgo, formatClock, parisHourKey } from '../lib/time';
import { isNightHour, sunTimes } from '../lib/sun';
import { isThunderstorm, wmoIcon, wmoLabel } from '../lib/wmo';
import {
  DASH,
  formatMeters,
  formatNumber,
  formatPercent,
  formatPrecip,
  formatTemp,
  formatWind,
  formatWindDir,
} from '../lib/format';
import {
  COLD_ALERT_C,
  GUST_ALERT_KMH,
  RAIN_ICON_MM,
  TEMP_LEGEND,
  computeAlerts,
  dayHourIndices,
  detectInversion,
  forecastDays,
  hourOf,
  indexForDay,
  inversionExplanation,
  summitIndex,
  tempColor,
  type AlertKind,
} from '../lib/weatherTable';
import { ViewFooter, ViewHeader, ViewPlaceholder, ViewSection } from './ViewShell';

interface Props {
  trackName: string;
  weather: WeatherState;
  model: WeatherModel;
  waitingForElevation: boolean;
  start: { lat: number; lon: number } | null;
  hourIndex: number | null;
  onSelectHour: (selection: HourSelection | null) => void;
}

const dayChipFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const dayLongFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const utcDay = (day: string) => new Date(`${day}T00:00Z`);

/** « 5° », « −3° », « – ». */
function tempShort(v: number | null | undefined): string {
  return v == null ? DASH : `${formatNumber(Math.round(v)).replace('-', '−')}°`;
}

const ALERT_ICONS: Record<AlertKind, string> = { gusts: '💨', storm: '⛈️', cold: '🥶', freezing: '❄️' };

/** Ligne sans bordure ni survol (bordures portées par les cellules, cf. border-separate). */
const ROW = 'border-0 hover:bg-transparent';
/** Colonne des libellés, figée lors du défilement horizontal. */
const STICKY = 'sticky left-0 z-2 h-auto border-r bg-card px-2.5 py-1 text-left text-xs/tight font-normal text-muted-foreground';

/**
 * Fond et couleur des cases d'en-tête (heures, lignes du sommet). Priorités de l'ancienne
 * feuille : heure affichée > nuit > alerte pour le fond, nuit > alerte pour le texte.
 */
function headState(night: boolean, selected: boolean, alert = false) {
  return cn(
    alert && 'bg-info font-bold text-info-foreground',
    night && 'bg-night text-night-foreground',
    selected && 'bg-accent shadow-[inset_0_-2px_0_var(--primary)]',
  );
}

/** Vue principale : tableau heatmap de la météo par altitude pour un jour. */
export function WeatherView({ trackName, weather, model, waitingForElevation, start, hourIndex, onSelectHour }: Props) {
  const { forecast, loading, error, refresh } = weather;
  const data = forecast?.data;
  const points = useMemo(() => forecast?.points ?? [], [forecast]);

  const days = useMemo(() => (data ? forecastDays(data.times) : []), [data]);
  const today = parisHourKey().slice(0, 10);
  const day = data && hourIndex !== null ? data.times[hourIndex].slice(0, 10) : today;
  const cols = useMemo(() => (data ? dayHourIndices(data.times, day) : []), [data, day]);
  const sun = start ? sunTimes(day, start.lat, start.lon) : null;

  // Alertes par jour (pour les pastilles des jours) et du jour affiché.
  const alertsByDay = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeAlerts>>();
    if (!data) return m;
    for (const d of days) m.set(d, computeAlerts(data.points, points, data.times, dayHourIndices(data.times, d)));
    return m;
  }, [data, days, points]);
  const alerts = alertsByDay.get(day) ?? [];

  const inversions = useMemo(
    () => (data ? cols.map((i) => detectInversion(data.points, points, i)) : []),
    [data, cols, points],
  );
  const strongestInversion = inversions.reduce<(typeof inversions)[number]>(
    (best, inv) => (inv && (!best || inv.diff > best.diff) ? inv : best),
    null,
  );

  const header = (
    <ViewHeader title="Météo par altitude" subtitle={trackName}>
      <span>
        {MODEL_LABELS[model]}
        {forecast && ` · mise à jour à ${formatClock(forecast.fetchedAt)} (${formatAgo(forecast.fetchedAt)})`}
      </span>
      <Button variant="outline" size="sm" onClick={refresh} disabled={loading || (!forecast && !error)}>
        {loading ? 'Chargement…' : 'Actualiser'}
      </Button>
    </ViewHeader>
  );

  if (waitingForElevation || error || !data || hourIndex === null) {
    return (
      <ViewSection>
        {header}
        <ViewPlaceholder>
          {waitingForElevation
            ? 'En attente des altitudes du tracé…'
            : error
              ? `Prévision indisponible : ${error}.`
              : loading
                ? 'Récupération de la prévision…'
                : 'Pas de prévision pour ce tracé.'}
        </ViewPlaceholder>
      </ViewSection>
    );
  }

  const series = data.points;
  const top = summitIndex(points);
  const summitEle = points[top]?.ele ?? Infinity;
  const anyFallback = model !== 'best_match' && cols.some((i) => !data.primary[i]);
  const isNight = (i: number) => !!sun && isNightHour(data.times[i], sun);

  return (
    <ViewSection>
      {header}

      {/* Jours : un seul choisi (la valeur vide, re-clic sur le jour affiché, est ignorée). */}
      <ToggleGroup
        type="single"
        variant="chip"
        spacing={1.5}
        value={day}
        onValueChange={(d) => d && onSelectHour({ key: forecast.key, index: indexForDay(data.times, d, hourIndex) })}
        aria-label="Jour"
        className="mb-2.5 w-full overflow-x-auto pb-1"
      >
        {days.map((d) => {
          const dayAlerts = alertsByDay.get(d) ?? [];
          const noon = data.times.findIndex((t) => t.startsWith(d) && hourOf(t) === 12);
          return (
            <ToggleGroupItem
              key={d}
              value={d}
              className="relative h-auto min-w-15.5 flex-col gap-0 px-2 py-1.25 text-xs"
              title={dayAlerts.map((a) => a.message).join('\n') || undefined}
            >
              <span>{d === today ? 'Auj.' : dayChipFmt.format(utcDay(d))}</span>
              <span className="text-lg/6">{noon >= 0 ? wmoIcon(series[top].weather_code[noon]) : ''}</span>
              {dayAlerts.length > 0 && (
                <span className="absolute top-0.5 right-1 text-2xs text-destructive" aria-label="Alertes">
                  ⚠
                </span>
              )}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <div className="mb-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        <strong className="first-letter:uppercase">{dayLongFmt.format(utcDay(day))}</strong>
        {sun?.sunrise && sun.sunset && (
          <span className="text-sm tabular-nums">
            🌅 {formatClock(sun.sunrise.getTime())} · 🌇 {formatClock(sun.sunset.getTime())}
          </span>
        )}
        {strongestInversion && (
          <Badge variant="warning" className="cursor-help" title={inversionExplanation(strongestInversion)} tabIndex={0}>
            ⇅ Inversion probable
          </Badge>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="mb-2.5 flex flex-col gap-1">
          {alerts.map((a) => (
            <Alert
              key={a.kind}
              variant={a.kind === 'freezing' ? 'info' : 'destructive'}
              role="note"
              className="block rounded-md border-0 border-l-4 px-2.5 py-1.5 text-sm/tight"
            >
              <span aria-hidden="true">{ALERT_ICONS[a.kind]}</span> {a.message}
            </Alert>
          ))}
        </div>
      )}

      {/* Table de shadcn (elle défile horizontalement) dans un cadre arrondi ; bordures sur les
          cellules (border-separate) pour garder celles de la colonne figée. */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table aria-label="Météo par altitude et par heure" className="border-separate border-spacing-0 tabular-nums">
          <TableHeader>
            <TableRow className={ROW}>
              <TableHead scope="col" className={cn(STICKY, 'border-b text-center')}>
                Heure
              </TableHead>
              {cols.map((i) => {
                const night = isNight(i);
                const selected = i === hourIndex;
                return (
                  <TableHead
                    key={i}
                    scope="col"
                    className={cn(
                      'h-auto cursor-pointer border-b px-0.5 py-1.5 text-center text-xs/tight font-bold text-foreground',
                      !night && !selected && 'hover:bg-accent',
                      headState(night, selected),
                    )}
                    onClick={() => onSelectHour({ key: forecast.key, index: i })}
                    title={`${night ? 'Nuit · ' : ''}Afficher ${hourOf(data.times[i])} h sur la carte${
                      !data.primary[i] && model !== 'best_match' ? ' (valeurs du modèle Open-Meteo)' : ''
                    }`}
                  >
                    {hourOf(data.times[i])} h{!data.primary[i] && model !== 'best_match' && <sup>*</sup>}
                    {night && <span className="block text-2xs/none">🌙</span>}
                  </TableHead>
                );
              })}
            </TableRow>
            <HeaderRow label="Temps" cols={cols} hourIndex={hourIndex} night={isNight}>
              {(i) => (
                <span className="text-lg/tight" title={wmoLabel(series[top].weather_code[i])}>
                  {wmoIcon(series[top].weather_code[i])}
                </span>
              )}
            </HeaderRow>
            <HeaderRow label="Nébulosité" cols={cols} hourIndex={hourIndex} night={isNight}>
              {(i) => <CloudBar value={series[top].cloud_cover[i]} />}
            </HeaderRow>
            <HeaderRow label="Risque de pluie" cols={cols} hourIndex={hourIndex} night={isNight}>
              {(i) => {
                const p = series[top].precipitation_probability[i];
                return <span className={cn(p != null && p >= 50 && 'font-bold text-info-foreground')}>{formatPercent(p)}</span>;
              }}
            </HeaderRow>
            <HeaderRow
              label="Isotherme 0 °C"
              cols={cols}
              hourIndex={hourIndex}
              night={isNight}
              alert={(i) => {
                const f = series[top].freezing_level_height[i];
                return f != null && f < summitEle;
              }}
            >
              {(i) => {
                const f = series[top].freezing_level_height[i];
                // Arrondi à 10 m : la précision du modèle ne justifie pas mieux.
                return f == null ? DASH : formatNumber(Math.round(f / 10) * 10);
              }}
            </HeaderRow>
            {strongestInversion && (
              <HeaderRow label="Inversion" cols={cols} hourIndex={hourIndex} night={isNight}>
                {(i) => {
                  const inv = inversions[cols.indexOf(i)];
                  return inv ? (
                    <span className="cursor-help font-bold text-warning-foreground" title={inversionExplanation(inv)}>
                      ⇅
                    </span>
                  ) : null;
                }}
              </HeaderRow>
            )}
          </TableHeader>
          <TableBody>
            {points.map((p, k) => (
              <TableRow key={k} className={ROW}>
                <TableHead scope="row" className={STICKY}>
                  <strong className="block text-sm/tight text-foreground">{formatMeters(p.ele)}</strong>
                  {p.roles.length > 0 && <span className="text-2xs">{rolesLabel(p.roles)}</span>}
                </TableHead>
                {cols.map((i) => (
                  <Cell
                    key={i}
                    point={p}
                    s={series[k]}
                    i={i}
                    hour={hourOf(data.times[i])}
                    isSummit={k === top}
                    selected={i === hourIndex}
                    night={isNight(i)}
                  />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ViewFooter
        legendLabel="Échelle des températures"
        legend={TEMP_LEGEND.map((t) => ({ key: t, label: tempShort(t), ...tempColor(t) }))}
      >
        Cases : température, <span className="opacity-75">ressenti</span>, vent (la flèche indique où il souffle) et 💧
        pluie &gt; {formatNumber(RAIN_ICON_MM, 1)} mm. Encadré rouge : rafales &gt; {GUST_ALERT_KMH} km/h au sommet ou
        ressenti &lt; {COLD_ALERT_C} °C. Ligne du haut : conditions au sommet. Isotherme en mètres.
        {anyFallback && ' * : au-delà de l’échéance d’AROME/ARPEGE, valeurs du modèle Open-Meteo.'} Cliquer sur une heure
        l’affiche sur la carte.
      </ViewFooter>
    </ViewSection>
  );
}

function HeaderRow({
  label,
  cols,
  hourIndex,
  night,
  alert,
  children,
}: {
  label: string;
  cols: number[];
  hourIndex: number;
  night: (i: number) => boolean;
  alert?: (i: number) => boolean;
  children: (i: number) => ReactNode;
}) {
  return (
    <TableRow className={ROW}>
      <TableHead scope="row" className={STICKY}>
        {label}
      </TableHead>
      {cols.map((i) => (
        <TableCell
          key={i}
          className={cn('border-b px-0.5 py-0.75 text-center text-xs/tight', headState(night(i), i === hourIndex, alert?.(i)))}
        >
          {children(i)}
        </TableCell>
      ))}
    </TableRow>
  );
}

function CloudBar({ value }: { value: number | null }) {
  if (value == null) return <>{DASH}</>;
  return (
    <span className="relative mx-0.75 block h-3.5 overflow-hidden rounded-xs bg-gauge" title={`Nébulosité ${formatPercent(value)}`}>
      <span className="absolute inset-y-0 left-0 bg-gauge-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      <span className="relative text-2xs/3.5">{formatPercent(value)}</span>
    </span>
  );
}

function WindArrow({ from }: { from: number | null }) {
  if (from == null) return null;
  // Direction météo = d'où vient le vent ; la flèche pointe vers où il souffle.
  return (
    <svg viewBox="0 0 10 10" width="11" height="11" style={{ transform: `rotate(${(from + 180) % 360}deg)` }} aria-hidden="true">
      <path d="M5 0 L9.5 5.5 H6.3 V10 H3.7 V5.5 H0.5 Z" fill="currentColor" />
    </svg>
  );
}

function Cell({
  point,
  s,
  i,
  hour,
  isSummit,
  selected,
  night,
}: {
  point: WeatherPoint;
  s: PointSeries;
  i: number;
  hour: number;
  isSummit: boolean;
  selected: boolean;
  night: boolean;
}) {
  const t = s.temperature_2m[i];
  const feel = s.apparent_temperature[i];
  const wind = s.wind_speed_10m[i];
  const gust = s.wind_gusts_10m[i];
  const dir = s.wind_direction_10m[i];
  const rain = s.precipitation[i];
  const storm = isThunderstorm(s.weather_code[i]);
  const gustAlert = isSummit && gust != null && gust > GUST_ALERT_KMH;
  const coldAlert = feel != null && feel < COLD_ALERT_C;
  const { bg, fg } = tempColor(t);

  const title =
    `${formatMeters(point.ele)} · ${hour} h — ${formatTemp(t)} (ressenti ${formatTemp(feel)}), ` +
    `vent ${formatWind(wind)} ${formatWindDir(dir)}, rafales ${formatWind(gust)}, pluie ${formatPrecip(rain)}` +
    (storm ? ', orage' : '') +
    (gustAlert ? ` — rafales > ${GUST_ALERT_KMH} km/h au sommet` : '') +
    (coldAlert ? ` — ressenti < ${COLD_ALERT_C} °C` : '');

  // Couleur de la température en style en ligne (donnée). Nuit : case désaturée et assombrie ;
  // alerte : encadré rouge ; heure affichée : contour vert.
  return (
    <TableCell
      className={cn(
        'h-16.5 min-w-13 border-r border-b border-cell-sep px-0.5 py-0.75 text-center max-md:min-w-11.5',
        night && 'brightness-88 saturate-35',
        (gustAlert || coldAlert) && 'inset-ring-2 inset-ring-destructive',
        selected && 'outline-2 -outline-offset-2 outline-primary',
      )}
      style={{ background: bg, color: fg }}
      title={title}
    >
      <div className="text-base/5 font-bold">
        {tempShort(t)}
        {storm && <span className="ml-px text-xs">⚡</span>}
      </div>
      <div className="text-2xs/3 opacity-85">{tempShort(feel)}</div>
      <div className={cn('inline-flex items-center gap-0.5 text-2xs/3', gustAlert && 'font-extrabold')}>
        <WindArrow from={dir} />
        {wind == null ? DASH : Math.round(wind)}
      </div>
      {rain != null && rain > RAIN_ICON_MM && <div className="text-2xs/3">💧{formatNumber(rain, 1)}</div>}
    </TableCell>
  );
}

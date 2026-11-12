import { useMemo, type ReactNode } from 'react';
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
    <header className="wview-header">
      <div className="wview-title">
        <h2>Météo par altitude</h2>
        <span className="wview-track">{trackName}</span>
      </div>
      <div className="wview-meta">
        <span>
          {MODEL_LABELS[model]}
          {forecast && ` · mise à jour à ${formatClock(forecast.fetchedAt)} (${formatAgo(forecast.fetchedAt)})`}
        </span>
        <button type="button" className="btn small" onClick={refresh} disabled={loading || (!forecast && !error)}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>
    </header>
  );

  if (waitingForElevation || error || !data || hourIndex === null) {
    return (
      <section className="wview">
        {header}
        <p className="wview-placeholder">
          {waitingForElevation
            ? 'En attente des altitudes du tracé…'
            : error
              ? `Prévision indisponible : ${error}.`
              : loading
                ? 'Récupération de la prévision…'
                : 'Pas de prévision pour ce tracé.'}
        </p>
      </section>
    );
  }

  const series = data.points;
  const top = summitIndex(points);
  const summitEle = points[top]?.ele ?? Infinity;
  const anyFallback = model !== 'best_match' && cols.some((i) => !data.primary[i]);

  return (
    <section className="wview">
      {header}

      <nav className="wday-chips" aria-label="Jour">
        {days.map((d) => {
          const dayAlerts = alertsByDay.get(d) ?? [];
          const noon = data.times.findIndex((t) => t.startsWith(d) && hourOf(t) === 12);
          return (
            <button
              key={d}
              type="button"
              className={`wday-chip${d === day ? ' active' : ''}`}
              onClick={() => onSelectHour({ key: forecast.key, index: indexForDay(data.times, d, hourIndex) })}
              title={dayAlerts.map((a) => a.message).join('\n') || undefined}
            >
              <span className="wday-name">{d === today ? 'Auj.' : dayChipFmt.format(utcDay(d))}</span>
              <span className="wday-icon">{noon >= 0 ? wmoIcon(series[top].weather_code[noon]) : ''}</span>
              {dayAlerts.length > 0 && <span className="wday-alert" aria-label="Alertes">⚠</span>}
            </button>
          );
        })}
      </nav>

      <div className="wview-day">
        <strong className="wview-dayname">{dayLongFmt.format(utcDay(day))}</strong>
        {sun?.sunrise && sun.sunset && (
          <span className="wview-sun">
            🌅 {formatClock(sun.sunrise.getTime())} · 🌇 {formatClock(sun.sunset.getTime())}
          </span>
        )}
        {strongestInversion && (
          <span className="badge badge-inversion" title={inversionExplanation(strongestInversion)} tabIndex={0}>
            ⇅ Inversion probable
          </span>
        )}
      </div>

      {alerts.length > 0 && (
        <ul className="walerts">
          {alerts.map((a) => (
            <li key={a.kind} className={`walert walert-${a.kind}`}>
              <span aria-hidden="true">{ALERT_ICONS[a.kind]}</span> {a.message}
            </li>
          ))}
        </ul>
      )}

      <div className="wtable-scroll">
        <table className="wtable">
          <thead>
            <tr className="wt-hours">
              <th scope="col" className="wt-corner">
                Heure
              </th>
              {cols.map((i) => {
                const night = sun ? isNightHour(data.times[i], sun) : false;
                return (
                  <th
                    key={i}
                    scope="col"
                    className={`wt-col${night ? ' night' : ''}${i === hourIndex ? ' selected' : ''}`}
                    onClick={() => onSelectHour({ key: forecast.key, index: i })}
                    title={`${night ? 'Nuit · ' : ''}Afficher ${hourOf(data.times[i])} h sur la carte${
                      !data.primary[i] && model !== 'best_match' ? ' (valeurs du modèle Open-Meteo)' : ''
                    }`}
                  >
                    {hourOf(data.times[i])} h{!data.primary[i] && model !== 'best_match' && <sup>*</sup>}
                    {night && <span className="wt-moon">🌙</span>}
                  </th>
                );
              })}
            </tr>
            <HeaderRow label="Temps" cols={cols} hourIndex={hourIndex} night={(i) => !!sun && isNightHour(data.times[i], sun)}>
              {(i) => (
                <span className="wt-picto" title={wmoLabel(series[top].weather_code[i])}>
                  {wmoIcon(series[top].weather_code[i])}
                </span>
              )}
            </HeaderRow>
            <HeaderRow label="Nébulosité" cols={cols} hourIndex={hourIndex} night={(i) => !!sun && isNightHour(data.times[i], sun)}>
              {(i) => <CloudBar value={series[top].cloud_cover[i]} />}
            </HeaderRow>
            <HeaderRow label="Risque de pluie" cols={cols} hourIndex={hourIndex} night={(i) => !!sun && isNightHour(data.times[i], sun)}>
              {(i) => {
                const p = series[top].precipitation_probability[i];
                return <span className={p != null && p >= 50 ? 'wt-strong' : undefined}>{formatPercent(p)}</span>;
              }}
            </HeaderRow>
            <HeaderRow
              label="Isotherme 0 °C"
              cols={cols}
              hourIndex={hourIndex}
              night={(i) => !!sun && isNightHour(data.times[i], sun)}
              cellClass={(i) => {
                const f = series[top].freezing_level_height[i];
                return f != null && f < summitEle ? 'wt-alert' : undefined;
              }}
            >
              {(i) => {
                const f = series[top].freezing_level_height[i];
                // Arrondi à 10 m : la précision du modèle ne justifie pas mieux.
                return f == null ? DASH : formatNumber(Math.round(f / 10) * 10);
              }}
            </HeaderRow>
            {strongestInversion && (
              <HeaderRow label="Inversion" cols={cols} hourIndex={hourIndex} night={(i) => !!sun && isNightHour(data.times[i], sun)}>
                {(i) => {
                  const inv = inversions[cols.indexOf(i)];
                  return inv ? (
                    <span className="wt-inv" title={inversionExplanation(inv)}>
                      ⇅
                    </span>
                  ) : null;
                }}
              </HeaderRow>
            )}
          </thead>
          <tbody>
            {points.map((p, k) => (
              <tr key={k}>
                <th scope="row" className="wt-point">
                  <strong>{formatMeters(p.ele)}</strong>
                  {p.roles.length > 0 && <span className="wt-role">{rolesLabel(p.roles)}</span>}
                </th>
                {cols.map((i) => (
                  <Cell
                    key={i}
                    point={p}
                    s={series[k]}
                    i={i}
                    hour={hourOf(data.times[i])}
                    isSummit={k === top}
                    selected={i === hourIndex}
                    night={!!sun && isNightHour(data.times[i], sun)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="wview-footer">
        <div className="temp-legend" aria-label="Échelle des températures">
          {TEMP_LEGEND.map((t) => {
            const c = tempColor(t);
            return (
              <span key={t} style={{ background: c.bg, color: c.fg }}>
                {tempShort(t)}
              </span>
            );
          })}
        </div>
        <p className="wview-notes">
          Cases : température, <span className="muted">ressenti</span>, vent (la flèche indique où il souffle) et 💧 pluie
          &gt; {formatNumber(RAIN_ICON_MM, 1)} mm. Encadré rouge : rafales &gt; {GUST_ALERT_KMH} km/h au sommet ou ressenti
          &lt; {COLD_ALERT_C} °C. Ligne du haut : conditions au sommet. Isotherme en mètres.
          {anyFallback && ' * : au-delà de l’échéance d’AROME/ARPEGE, valeurs du modèle Open-Meteo.'} Cliquer sur une heure
          l’affiche sur la carte.
        </p>
      </footer>
    </section>
  );
}

function HeaderRow({
  label,
  cols,
  hourIndex,
  night,
  cellClass,
  children,
}: {
  label: string;
  cols: number[];
  hourIndex: number;
  night: (i: number) => boolean;
  cellClass?: (i: number) => string | undefined;
  children: (i: number) => ReactNode;
}) {
  return (
    <tr className="wt-info">
      <th scope="row">{label}</th>
      {cols.map((i) => (
        <td key={i} className={[night(i) && 'night', i === hourIndex && 'selected', cellClass?.(i)].filter(Boolean).join(' ')}>
          {children(i)}
        </td>
      ))}
    </tr>
  );
}

function CloudBar({ value }: { value: number | null }) {
  if (value == null) return <>{DASH}</>;
  return (
    <span className="wt-cloud" title={`Nébulosité ${formatPercent(value)}`}>
      <span className="wt-cloud-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      <span className="wt-cloud-text">{formatPercent(value)}</span>
    </span>
  );
}

function WindArrow({ from }: { from: number | null }) {
  if (from == null) return null;
  // Direction météo = d'où vient le vent ; la flèche pointe vers où il souffle.
  return (
    <svg className="wt-arrow" viewBox="0 0 10 10" width="11" height="11" style={{ transform: `rotate(${(from + 180) % 360}deg)` }} aria-hidden="true">
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
  const classes = ['wt-cell', night && 'night', selected && 'selected', (gustAlert || coldAlert) && 'alert'].filter(Boolean).join(' ');

  const title =
    `${formatMeters(point.ele)} · ${hour} h — ${formatTemp(t)} (ressenti ${formatTemp(feel)}), ` +
    `vent ${formatWind(wind)} ${formatWindDir(dir)}, rafales ${formatWind(gust)}, pluie ${formatPrecip(rain)}` +
    (storm ? ', orage' : '') +
    (gustAlert ? ` — rafales > ${GUST_ALERT_KMH} km/h au sommet` : '') +
    (coldAlert ? ` — ressenti < ${COLD_ALERT_C} °C` : '');

  return (
    <td className={classes} style={{ background: bg, color: fg }} title={title}>
      <div className="c-temp">
        {tempShort(t)}
        {storm && <span className="c-storm">⚡</span>}
      </div>
      <div className="c-feel">{tempShort(feel)}</div>
      <div className={`c-wind${gustAlert ? ' strong' : ''}`}>
        <WindArrow from={dir} />
        {wind == null ? DASH : Math.round(wind)}
      </div>
      {rain != null && rain > RAIN_ICON_MM && <div className="c-rain">💧{formatNumber(rain, 1)}</div>}
    </td>
  );
}

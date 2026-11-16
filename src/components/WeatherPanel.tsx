import { useState } from 'react';
import type { WeatherModel } from '../types';
import type { WeatherState } from '../hooks/useWeather';
import { MODEL_LABELS } from '../services/weather';
import { isKeyPoint, rolesLabel } from '../lib/weatherPoints';
import { formatClock, formatAgo, parisHourKey } from '../lib/time';
import { currentHourIndex, formatForecastHour, type HourSelection } from '../lib/forecast';
import { daylightInfo, isNightHour, sunTimes } from '../lib/sun';
import {
  DASH,
  formatDuration,
  formatHoursMinutes,
  formatMeters,
  formatPercent,
  formatPrecip,
  formatTemp,
  formatWind,
  formatWindDir,
} from '../lib/format';
import { wmoIcon, wmoLabel } from '../lib/wmo';

interface Props {
  weather: WeatherState;
  model: WeatherModel;
  waitingForElevation: boolean;
  /** Point de départ du tracé (pour le lever / coucher du soleil). */
  start: { lat: number; lon: number } | null;
  /** Durée estimée de la rando (DIN 33466), en heures. */
  durationHours: number | null;
  /** Indice de l'heure affichée (null tant que la prévision n'est pas chargée). */
  hourIndex: number | null;
  onSelectHour: (selection: HourSelection | null) => void;
  /** Ouvre le tableau par altitude (absent si déjà affiché). */
  onOpenTable?: () => void;
}

export function WeatherPanel({
  weather,
  model,
  waitingForElevation,
  start,
  durationHours,
  hourIndex,
  onSelectHour,
  onOpenTable,
}: Props) {
  const { forecast, loading, error, refresh } = weather;
  const data = forecast?.data;
  const index = data && hourIndex !== null ? hourIndex : null;
  const nowIndex = data ? currentHourIndex(data.times) : 0;
  const go = (i: number) => forecast && onSelectHour({ key: forecast.key, index: i });
  // Tableau allégé : points clés seulement, sauf dépliage (non persisté, repart replié à chaque
  // tracé grâce à la `key` posée par App).
  const [showAll, setShowAll] = useState(false);
  const hasIntermediate = forecast ? forecast.points.some((p) => !isKeyPoint(p)) : false;

  // Jour affiché : celui de l'heure sélectionnée, sinon aujourd'hui.
  const day = data && index !== null ? data.times[index].slice(0, 10) : parisHourKey().slice(0, 10);
  const sun = start ? daylightInfo(day, start.lat, start.lon, durationHours) : null;
  const night = data && index !== null && start ? isNightHour(data.times[index], sunTimes(day, start.lat, start.lon)) : false;

  return (
    <section className="weather" aria-label="Météo">
      <header className="weather-header">
        <p className="weather-meta">
          {MODEL_LABELS[model]}
          {forecast && (
            <>
              {' · mise à jour à '}
              {formatClock(forecast.fetchedAt)} ({formatAgo(forecast.fetchedAt)})
            </>
          )}
        </p>
        <button type="button" className="btn small" onClick={refresh} disabled={loading || (!forecast && !error)}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </header>

      {sun && <SunBlock sun={sun} durationHours={durationHours} />}

      {onOpenTable && !waitingForElevation && (
        <button type="button" className="btn weather-open-table" onClick={onOpenTable}>
          🌡 Tableau météo par altitude
        </button>
      )}

      {waitingForElevation ? (
        <p className="weather-info">En attente des altitudes du tracé…</p>
      ) : error ? (
        <p className="weather-error">
          Prévision indisponible : {error}.{' '}
          <button type="button" className="link-btn" onClick={refresh}>
            Réessayer
          </button>
        </p>
      ) : !data || index === null ? (
        loading && <p className="weather-info spinner-text">Récupération de la prévision…</p>
      ) : (
        <>
          <div className="weather-nav">
            <button type="button" className="icon-btn" onClick={() => go(index - 1)} disabled={index <= 0} aria-label="Heure précédente">
              ‹
            </button>
            <span className={`weather-hour${night ? ' night' : ''}`}>
              {formatForecastHour(data.times[index])}
              {night && <span className="night-tag"> · 🌙 nuit</span>}
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => go(index + 1)}
              disabled={index >= data.times.length - 1}
              aria-label="Heure suivante"
            >
              ›
            </button>
            {index !== nowIndex && (
              <button type="button" className="link-btn" onClick={() => onSelectHour(null)}>
                maintenant
              </button>
            )}
          </div>

          {/* Conditions générales à cette heure (point le plus haut). */}
          <dl className="weather-summary">
            <div>
              <dt>Temps</dt>
              <dd title={wmoLabel(data.points[0].weather_code[index])}>
                {wmoIcon(data.points[0].weather_code[index])} {wmoLabel(data.points[0].weather_code[index])}
              </dd>
            </div>
            <div>
              <dt>Isotherme 0 °C</dt>
              <dd>{formatMeters(data.points[0].freezing_level_height[index])}</dd>
            </div>
            <div>
              <dt>Nébulosité</dt>
              <dd>{formatPercent(data.points[0].cloud_cover[index])}</dd>
            </div>
            <div>
              <dt>Risque de pluie</dt>
              <dd>{formatPercent(data.points[0].precipitation_probability[index])}</dd>
            </div>
          </dl>

          <table className="weather-table">
            <thead>
              <tr>
                <th>Point</th>
                <th>Temp.</th>
                <th>Vent</th>
                <th>Pluie</th>
              </tr>
            </thead>
            <tbody>
              {forecast.points.map((p, i) => {
                if (!showAll && !isKeyPoint(p)) return null;
                const s = data.points[i];
                const label = rolesLabel(p.roles);
                return (
                  <tr key={i}>
                    <td>
                      <strong>{formatMeters(p.ele)}</strong>
                      {label && <span className="weather-role">{label}</span>}
                    </td>
                    <td>
                      {formatTemp(s.temperature_2m[index])}
                      <span className="weather-sub">ress. {formatTemp(s.apparent_temperature[index])}</span>
                    </td>
                    <td>
                      {formatWind(s.wind_speed_10m[index])} {formatWindDir(s.wind_direction_10m[index])}
                      <span className="weather-sub">raf. {formatWind(s.wind_gusts_10m[index])}</span>
                    </td>
                    <td>{formatPrecip(s.precipitation[index])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasIntermediate && (
            <button type="button" className="link-btn weather-more" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              {showAll ? 'Points clés seulement' : `Voir les ${forecast.points.length} points`}
            </button>
          )}

          {model !== 'best_match' && !data.primary[index] && (
            <p className="weather-info">Au-delà de l’échéance d’AROME/ARPEGE : valeurs complétées par le modèle Open-Meteo.</p>
          )}
          {data.points[0].temperature_2m[index] === null && <p className="weather-info">{DASH} : donnée non fournie par le modèle.</p>}
        </>
      )}
    </section>
  );
}

function SunBlock({ sun, durationHours }: { sun: ReturnType<typeof daylightInfo>; durationHours: number | null }) {
  if (!sun.sunrise || !sun.sunset) {
    return <p className="sun">Pas de lever ni de coucher du soleil ce jour-là.</p>;
  }
  return (
    <div className="sun" title="Calculé au point de départ, sur un horizon dégagé : le relief peut cacher le soleil plus tôt.">
      <p className="sun-times">
        <span>
          🌅 Lever <strong>{formatClock(sun.sunrise.getTime())}</strong>
        </span>
        <span>
          🌇 Coucher <strong>{formatClock(sun.sunset.getTime())}</strong>
        </span>
        <span className="sun-length">jour {formatHoursMinutes(sun.daylightHours)}</span>
      </p>
      {durationHours !== null &&
        (sun.longerThanDay ? (
          <p className="sun-warning">
            ⚠ Durée estimée ({formatDuration(durationHours)}) plus longue que la journée : prévoir une frontale.
          </p>
        ) : (
          sun.latestStart && (
            <p className="sun-advice">
              Départ au plus tard à <strong>{formatClock(sun.latestStart.getTime())}</strong> pour finir avant la nuit (durée
              estimée {formatDuration(durationHours)}).
            </p>
          )
        ))}
    </div>
  );
}

import { useState } from 'react';
import type { WeatherModel } from '../types';
import type { WeatherState } from '../hooks/useWeather';
import { MODEL_LABELS } from '../services/weather';
import { rolesLabel } from '../lib/weatherPoints';
import { formatClock, formatAgo, parisHourKey } from '../lib/time';
import { formatMeters, formatPercent, formatPrecip, formatTemp, formatWind, DASH } from '../lib/format';
import { wmoIcon, wmoLabel } from '../lib/wmo';

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const windFrom = (deg: number | null) => (deg == null ? '' : DIRS[Math.round(deg / 45) % 8]);

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
/** « jeu. 12 nov. · 14 h » à partir de « 2026-11-12T14:00 » (heure locale déjà fournie par l'API). */
function hourLabel(time: string): string {
  const [date, hm] = time.split('T');
  return `${dayFmt.format(new Date(`${date}T00:00Z`))} · ${Number(hm.slice(0, 2))} h`;
}

interface Props {
  weather: WeatherState;
  model: WeatherModel;
  waitingForElevation: boolean;
}

export function WeatherPanel({ weather, model, waitingForElevation }: Props) {
  const { forecast, loading, error, refresh } = weather;
  // Heure affichée : null = heure courante.
  const [offset, setOffset] = useState<{ key: string; index: number } | null>(null);

  const data = forecast?.data;
  const nowIndex = data ? Math.max(0, data.times.indexOf(parisHourKey())) : 0;
  const index = data && offset?.key === forecast?.key ? Math.min(Math.max(offset.index, 0), data.times.length - 1) : nowIndex;
  const go = (i: number) => forecast && setOffset({ key: forecast.key, index: i });

  return (
    <section className="weather" aria-label="Météo">
      <header className="weather-header">
        <h2>Météo</h2>
        <button type="button" className="btn small" onClick={refresh} disabled={loading || (!forecast && !error)}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </header>
      <p className="weather-meta">
        {MODEL_LABELS[model]}
        {forecast && (
          <>
            {' · mise à jour à '}
            {formatClock(forecast.fetchedAt)} ({formatAgo(forecast.fetchedAt)})
          </>
        )}
      </p>

      {waitingForElevation ? (
        <p className="weather-info">En attente des altitudes du tracé…</p>
      ) : error ? (
        <p className="weather-error">
          Prévision indisponible : {error}.{' '}
          <button type="button" className="link-btn" onClick={refresh}>
            Réessayer
          </button>
        </p>
      ) : !data ? (
        loading && <p className="weather-info spinner-text">Récupération de la prévision…</p>
      ) : (
        <>
          <div className="weather-nav">
            <button type="button" className="icon-btn" onClick={() => go(index - 1)} disabled={index <= 0} aria-label="Heure précédente">
              ‹
            </button>
            <span className="weather-hour">{hourLabel(data.times[index])}</span>
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
              <button type="button" className="link-btn" onClick={() => setOffset(null)}>
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
                      {formatWind(s.wind_speed_10m[index])} {windFrom(s.wind_direction_10m[index])}
                      <span className="weather-sub">raf. {formatWind(s.wind_gusts_10m[index])}</span>
                    </td>
                    <td>{formatPrecip(s.precipitation[index])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {model !== 'best_match' && !data.primary[index] && (
            <p className="weather-info">
              Au-delà de l’échéance d’AROME/ARPEGE : valeurs complétées par le modèle Open-Meteo.
            </p>
          )}
          {data.points[0].temperature_2m[index] === null && <p className="weather-info">{DASH} : donnée non fournie par le modèle.</p>}
        </>
      )}
    </section>
  );
}

import { TIP } from './classes';
import type { PointSeries } from '../services/weather';
import type { WeatherPoint } from '../lib/weatherPoints';
import { rolesLabel } from '../lib/weatherPoints';
import { formatForecastHour } from '../lib/forecast';
import { formatMeters, formatPercent, formatPrecip, formatTemp, formatWind, formatWindDir } from '../lib/format';
import { wmoIcon, wmoLabel } from '../lib/wmo';

interface Props {
  point: WeatherPoint;
  /** Séries météo du point et heure affichée ; absentes tant que la prévision n'est pas chargée. */
  series?: PointSeries;
  time?: string;
  index?: number;
  night?: boolean;
  /** Titre affiché avant l'altitude (ex. « Point culminant »). */
  title?: string;
}

/** Contenu de l'infobulle d'un point météo sur la carte. */
export function WeatherPointTooltip({ point, series, time, index, night, title }: Props) {
  const roles = rolesLabel(point.roles);
  return (
    <div className={TIP.root}>
      <div className={TIP.title}>
        {title && `${title} · `}
        <strong>{formatMeters(point.ele)}</strong>
        {roles && ` · ${roles}`}
      </div>
      {series && time !== undefined && index !== undefined ? (
        <>
          <div className={TIP.hour}>
            {formatForecastHour(time)}
            {night && ' · 🌙 nuit'}
          </div>
          <div className={TIP.main}>
            <span className={TIP.icon}>{wmoIcon(series.weather_code[index])}</span>
            <span>
              <strong className={TIP.temp}>{formatTemp(series.temperature_2m[index])}</strong>
              <span className={TIP.sub}> ressenti {formatTemp(series.apparent_temperature[index])}</span>
              <br />
              <span className={TIP.sub}>{wmoLabel(series.weather_code[index])}</span>
            </span>
          </div>
          <div>
            Vent {formatWind(series.wind_speed_10m[index])} {formatWindDir(series.wind_direction_10m[index])} · rafales{' '}
            {formatWind(series.wind_gusts_10m[index])}
          </div>
          <div>
            Pluie {formatPrecip(series.precipitation[index])} · risque {formatPercent(series.precipitation_probability[index])}
          </div>
        </>
      ) : (
        <div className={TIP.sub}>Point de prévision météo</div>
      )}
    </div>
  );
}

import { TIP } from './classes';
import type { WeatherSample } from '../lib/trackForecast';
import { formatClockMinutes } from '../lib/trackForecast';
import { formatDuration, formatMeters, formatPercent, formatPrecip, formatTemp, formatWind, formatWindDir } from '../lib/format';
import { wmoIcon, wmoLabel } from '../lib/wmo';

export interface PassageInfo {
  /** Minutes depuis minuit le jour du départ. */
  clockMinutes: number;
  elapsedHours: number;
  ele: number | null;
  sample: WeatherSample | null;
  night: boolean;
}

/** Infobulle du tracé : heure de passage estimée, altitude et météo à ce moment-là. */
export function PassageTooltip({ info }: { info: PassageInfo }) {
  const s = info.sample;
  return (
    <div className={TIP.root}>
      <div className={TIP.title}>
        Passage ≈ <strong>{formatClockMinutes(info.clockMinutes)}</strong>
        <span className={TIP.sub}> · {info.elapsedHours < 1 / 60 ? 'départ' : `+${formatDuration(info.elapsedHours)}`}</span>
        {info.night && ' · 🌙'}
      </div>
      <div className={TIP.hour}>Altitude {formatMeters(info.ele)}</div>
      {s ? (
        <>
          <div className={TIP.main}>
            <span className={TIP.icon}>{wmoIcon(s.code)}</span>
            <span>
              <strong className={TIP.temp}>{formatTemp(s.temperature)}</strong>
              <span className={TIP.sub}> ressenti {formatTemp(s.apparent)}</span>
              <br />
              <span className={TIP.sub}>{wmoLabel(s.code)}</span>
            </span>
          </div>
          <div>
            Vent {formatWind(s.wind)} {formatWindDir(s.direction)} · rafales {formatWind(s.gusts)}
          </div>
          <div>
            Pluie {formatPrecip(s.precipitation)} · risque {formatPercent(s.probability)}
          </div>
        </>
      ) : (
        <div className={TIP.sub}>Au-delà de la période couverte par la prévision</div>
      )}
    </div>
  );
}

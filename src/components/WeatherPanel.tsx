import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from './IconButton';
import { Alert } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { LABEL_CAPS, SUB_LINE } from './classes';
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

/** Message discret sous le tableau (attente, complément de modèle…). */
const INFO = 'mt-1.5 mb-0 text-xs text-muted-foreground';
/** Cellule du tableau des points : compacte, alignée en haut. */
const CELL = 'p-1 align-top';
/** Encadré du soleil. */
const SUN = 'mb-2 block rounded-md px-2 py-1.5 text-sm/snug';

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
    <section className="text-sm/tight" aria-label="Météo">
      <header className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 text-2xs text-muted-foreground">
          {MODEL_LABELS[model]}
          {forecast && (
            <>
              {' · mise à jour à '}
              {formatClock(forecast.fetchedAt)} ({formatAgo(forecast.fetchedAt)})
            </>
          )}
        </p>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading || (!forecast && !error)}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </Button>
      </header>

      {sun && <SunBlock sun={sun} durationHours={durationHours} />}

      {onOpenTable && !waitingForElevation && (
        <Button variant="outline" className="mb-2 w-full font-semibold" onClick={onOpenTable}>
          <Thermometer />
          Tableau météo par altitude
        </Button>
      )}

      {waitingForElevation ? (
        <p className={INFO}>En attente des altitudes du tracé…</p>
      ) : error ? (
        <p className="mt-1.5 mb-0 text-destructive">
          Prévision indisponible : {error}.{' '}
          <Button variant="link" size="inline" onClick={refresh}>
            Réessayer
          </Button>
        </p>
      ) : !data || index === null ? (
        loading && <p className={cn(INFO, 'spinner-text')}>Récupération de la prévision…</p>
      ) : (
        <>
          <div className="mb-1.5 flex items-center gap-1">
            <IconButton onClick={() => go(index - 1)} disabled={index <= 0} aria-label="Heure précédente">
              <ChevronLeft />
            </IconButton>
            <span className={cn('min-w-[9.5em] text-center font-semibold', night && 'text-night-accent')}>
              {formatForecastHour(data.times[index])}
              {night && <span className="font-normal"> · 🌙 nuit</span>}
            </span>
            <IconButton onClick={() => go(index + 1)} disabled={index >= data.times.length - 1} aria-label="Heure suivante">
              <ChevronRight />
            </IconButton>
            {index !== nowIndex && (
              <Button variant="link" size="inline" onClick={() => onSelectHour(null)}>
                maintenant
              </Button>
            )}
          </div>

          {/* Conditions générales à cette heure (point le plus haut). */}
          <dl className="m-0 mb-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <Summary label="Temps" title={wmoLabel(data.points[0].weather_code[index])}>
              {wmoIcon(data.points[0].weather_code[index])} {wmoLabel(data.points[0].weather_code[index])}
            </Summary>
            <Summary label="Isotherme 0 °C">{formatMeters(data.points[0].freezing_level_height[index])}</Summary>
            <Summary label="Nébulosité">{formatPercent(data.points[0].cloud_cover[index])}</Summary>
            <Summary label="Risque de pluie">{formatPercent(data.points[0].precipitation_probability[index])}</Summary>
          </dl>

          {/* Tableau des points (Table de shadcn) : lignes séparées, sans survol (non cliquables). */}
          <Table className="text-sm/tight tabular-nums">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Point', 'Temp.', 'Vent', 'Pluie'].map((h) => (
                  <TableHead key={h} className={cn(LABEL_CAPS, 'h-auto px-1 py-0.5 font-normal')}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecast.points.map((p, i) => {
                if (!showAll && !isKeyPoint(p)) return null;
                const s = data.points[i];
                const label = rolesLabel(p.roles);
                return (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell className={CELL}>
                      <strong>{formatMeters(p.ele)}</strong>
                      {label && <span className={SUB_LINE}>{label}</span>}
                    </TableCell>
                    <TableCell className={CELL}>
                      {formatTemp(s.temperature_2m[index])}
                      <span className={SUB_LINE}>ress. {formatTemp(s.apparent_temperature[index])}</span>
                    </TableCell>
                    <TableCell className={CELL}>
                      {formatWind(s.wind_speed_10m[index])} {formatWindDir(s.wind_direction_10m[index])}
                      <span className={SUB_LINE}>raf. {formatWind(s.wind_gusts_10m[index])}</span>
                    </TableCell>
                    <TableCell className={CELL}>{formatPrecip(s.precipitation[index])}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {hasIntermediate && (
            <Button
              variant="link"
              size="inline"
              className="mt-1.5 flex w-full justify-center text-sm"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
            >
              {showAll ? 'Points clés seulement' : `Voir les ${forecast.points.length} points`}
            </Button>
          )}

          {model !== 'best_match' && !data.primary[index] && (
            <p className={INFO}>Au-delà de l’échéance d’AROME/ARPEGE : valeurs complétées par le modèle Open-Meteo.</p>
          )}
          {data.points[0].temperature_2m[index] === null && <p className={INFO}>{DASH} : donnée non fournie par le modèle.</p>}
        </>
      )}
    </section>
  );
}

function SunBlock({ sun, durationHours }: { sun: ReturnType<typeof daylightInfo>; durationHours: number | null }) {
  // Alert « warning » ; rôle « note » (et non « alert ») : information, pas une urgence à
  // annoncer par les lecteurs d'écran à chaque rendu.
  if (!sun.sunrise || !sun.sunset) {
    return (
      <Alert variant="warning" role="note" className={SUN}>
        Pas de lever ni de coucher du soleil ce jour-là.
      </Alert>
    );
  }
  return (
    <Alert
      variant="warning"
      role="note"
      className={SUN}
      title="Calculé au point de départ, sur un horizon dégagé : le relief peut cacher le soleil plus tôt."
    >
      <p className="m-0 flex flex-wrap gap-x-2.5 gap-y-0.5 tabular-nums">
        <span>
          🌅 Lever <strong>{formatClock(sun.sunrise.getTime())}</strong>
        </span>
        <span>
          🌇 Coucher <strong>{formatClock(sun.sunset.getTime())}</strong>
        </span>
        <span className="text-muted-foreground">jour {formatHoursMinutes(sun.daylightHours)}</span>
      </p>
      {durationHours !== null &&
        (sun.longerThanDay ? (
          <p className="mt-1 mb-0 font-semibold text-destructive">
            ⚠ Durée estimée ({formatDuration(durationHours)}) plus longue que la journée : prévoir une frontale.
          </p>
        ) : (
          sun.latestStart && (
            <p className="mt-1 mb-0">
              Départ au plus tard à <strong>{formatClock(sun.latestStart.getTime())}</strong> pour finir avant la nuit (durée
              estimée {formatDuration(durationHours)}).
            </p>
          )
        ))}
    </Alert>
  );
}

/** Une donnée du résumé (point le plus haut) : libellé en capitales, valeur sur une ligne. */
function Summary({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={LABEL_CAPS}>{label}</dt>
      <dd className="m-0 truncate font-semibold" title={title}>
        {children}
      </dd>
    </div>
  );
}

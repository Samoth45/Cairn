import { COLORING_LABELS, LEGENDS, formatClockMinutes, type TrackColoring } from '../lib/trackForecast';
import { formatClock } from '../lib/time';
import { formatDuration } from '../lib/format';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { MAP_CONTROL } from './classes';

/** Contrôles du panneau : 14 px aussi sur mobile (16 px par défaut), sinon ils ne tiennent pas. */
const COMPACT = 'max-md:text-sm';

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export interface PassageSummary {
  /** Minutes depuis minuit le jour du départ. */
  departureMinutes: number;
  durationHours: number;
  /** Une partie du parcours est au-delà de la période couverte par la prévision. */
  beyondForecast: boolean;
  sunset: Date | null;
  /** Arrivée estimée après le coucher du soleil. */
  afterSunset: boolean;
}

interface Props {
  coloring: TrackColoring;
  onColoring: (c: TrackColoring) => void;
  days: string[];
  today: string;
  day: string;
  onDay: (day: string) => void;
  departureTime: string;
  onDepartureTime: (hhmm: string) => void;
  summary: PassageSummary | null;
}

/** Panneau sur la carte : coloration du tracé selon la prévision à l'heure de passage. */
export function ForecastControl(p: Props) {
  const legend = p.coloring === 'none' ? null : LEGENDS[p.coloring];
  return (
    <Card
      size="sm"
      aria-label="Prévision sur le tracé"
      className={cn(
        MAP_CONTROL,
        'bottom-6 left-2.5 w-[min(320px,calc(100%-80px))] gap-0 rounded-lg bg-card-glass px-2.5 py-2 text-sm ring-0 max-md:bottom-3',
      )}
    >
      <label className="flex items-center gap-2">
        <span className="flex-1 font-semibold">Colorer le tracé</span>
        <NativeSelect size="sm" selectClassName={COMPACT} value={p.coloring} onChange={(e) => p.onColoring(e.target.value as TrackColoring)}>
          {(Object.keys(COLORING_LABELS) as TrackColoring[]).map((c) => (
            <NativeSelectOption key={c} value={c}>
              {COLORING_LABELS[c]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      {legend && (
        <>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <NativeSelect size="sm" className="shrink-0" selectClassName={COMPACT} value={p.day} onChange={(e) => p.onDay(e.target.value)} aria-label="Jour de la rando">
              {p.days.map((d) => (
                <NativeSelectOption key={d} value={d}>
                  {d === p.today ? 'Aujourd’hui' : dayFmt.format(new Date(`${d}T00:00Z`))}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <label className="flex min-w-0 items-center gap-1 text-muted-foreground">
              départ
              <Input
                type="time"
                step={900}
                value={p.departureTime}
                onChange={(e) => e.target.value && p.onDepartureTime(e.target.value)}
                className={cn('h-7 min-w-0 px-1.5 text-foreground', COMPACT)}
              />
            </label>
          </div>

          <div
            className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs tabular-nums"
            aria-label={`Légende : ${COLORING_LABELS[p.coloring]}`}
          >
            {legend.items.map((it) => (
              <span key={it.label} className="inline-flex items-center gap-0.5">
                <i className="inline-block h-2 w-3 rounded-xs ring-1 ring-swatch-outline" style={{ background: it.color }} />
                {it.label}
              </span>
            ))}
            <span className="text-muted-foreground">{legend.unit}</span>
          </div>

          {p.summary && (
            <p className="mt-1.5 mb-0 tabular-nums">
              Arrivée ≈ <strong>{formatClockMinutes(p.summary.departureMinutes + p.summary.durationHours * 60)}</strong> (
              {formatDuration(p.summary.durationHours)})
              {p.summary.afterSunset && p.summary.sunset && (
                <span className="font-semibold text-destructive">
                  {' '}
                  · après le coucher du soleil ({formatClock(p.summary.sunset.getTime())})
                </span>
              )}
              {p.summary.beyondForecast && <span className="text-muted-foreground"> · gris : au-delà de la prévision</span>}
            </p>
          )}
          <p className="mt-1 mb-0 text-2xs text-muted-foreground max-md:hidden">
            Survolez le tracé pour l’heure de passage et la météo.
          </p>
        </>
      )}
    </Card>
  );
}

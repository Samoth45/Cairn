import { COLORING_LABELS, LEGENDS, formatClockMinutes, type TrackColoring } from '../lib/trackForecast';
import { formatClock } from '../lib/time';
import { formatDuration } from '../lib/format';

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
    <div className="fc-panel" aria-label="Prévision sur le tracé">
      <label className="fc-row">
        <span className="fc-label">Colorer le tracé</span>
        <select value={p.coloring} onChange={(e) => p.onColoring(e.target.value as TrackColoring)}>
          {(Object.keys(COLORING_LABELS) as TrackColoring[]).map((c) => (
            <option key={c} value={c}>
              {COLORING_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      {legend && (
        <>
          <div className="fc-row fc-departure">
            <select value={p.day} onChange={(e) => p.onDay(e.target.value)} aria-label="Jour de la rando">
              {p.days.map((d) => (
                <option key={d} value={d}>
                  {d === p.today ? 'Aujourd’hui' : dayFmt.format(new Date(`${d}T00:00Z`))}
                </option>
              ))}
            </select>
            <label>
              départ{' '}
              <input
                type="time"
                step={900}
                value={p.departureTime}
                onChange={(e) => e.target.value && p.onDepartureTime(e.target.value)}
              />
            </label>
          </div>

          <div className="fc-legend" aria-label={`Légende : ${COLORING_LABELS[p.coloring]}`}>
            {legend.items.map((it) => (
              <span key={it.label} className="fc-legend-item">
                <i style={{ background: it.color }} />
                {it.label}
              </span>
            ))}
            <span className="fc-unit">{legend.unit}</span>
          </div>

          {p.summary && (
            <p className="fc-summary">
              Arrivée ≈ <strong>{formatClockMinutes(p.summary.departureMinutes + p.summary.durationHours * 60)}</strong> (
              {formatDuration(p.summary.durationHours)})
              {p.summary.afterSunset && p.summary.sunset && (
                <span className="fc-warn"> · après le coucher du soleil ({formatClock(p.summary.sunset.getTime())})</span>
              )}
              {p.summary.beyondForecast && <span className="fc-muted"> · gris : au-delà de la prévision</span>}
            </p>
          )}
          <p className="fc-hint">Survolez le tracé pour l’heure de passage et la météo.</p>
        </>
      )}
    </div>
  );
}

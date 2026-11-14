import { useMemo } from 'react';
import type { DinSpeeds, ScoreWeights, WeatherModel } from '../types';
import type { CachedForecast } from '../db/db';
import type { TrackForecastEntry } from '../hooks/useAllForecasts';
import { MODEL_LABELS } from '../services/weather';
import { dinDurationHours } from '../lib/din';
import { departureIndex, makeWeatherSampler, passageHours } from '../lib/trackForecast';
import {
  computeDayScore,
  PENALTY_ICONS,
  PENALTY_LABELS,
  reliability,
  scoreColor,
  type DayScore,
} from '../lib/score';
import { formatDuration } from '../lib/format';

interface Props {
  entries: TrackForecastEntry[];
  days: string[];
  today: string;
  model: WeatherModel;
  din: DinSpeeds;
  weights: ScoreWeights;
  departureTime: string;
  departureMinutes: number;
  loading: boolean;
  onDepartureTime: (hhmm: string) => void;
  onRefresh: () => void;
  onOpenDay: (trackId: string, day: string, forecast: CachedForecast) => void;
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const RELIABILITY_LABELS = {
  good: 'Prévision fiable',
  medium: 'Fiabilité moyenne (J+3 à J+4)',
  low: 'Fiabilité faible (au-delà de J+4) : tendance seulement',
};

interface Row {
  entry: TrackForecastEntry;
  durationHours: number | null;
  scores: Array<DayScore | null>;
  best: number;
}

/** Vue récapitulative : score de 0 à 100 par tracé et par jour. */
export function SummaryView(p: Props) {
  const rows: Row[] = useMemo(
    () =>
      p.entries.map((entry) => {
        const { stats, profile } = entry.analysis;
        const durationHours =
          stats.ascentM !== null ? dinDurationHours(stats.distanceM / 1000, stats.ascentM, stats.descentM ?? 0, p.din) : null;
        const f = entry.forecast;
        if (!f || durationHours === null) return { entry, durationHours, scores: p.days.map(() => null), best: -1 };
        const passage = passageHours(profile, p.din, durationHours);
        const sample = makeWeatherSampler(f.data, f.points);
        const scores = p.days.map((day) => {
          const startIndex = departureIndex(f.data.times, day, p.departureMinutes);
          if (startIndex === null) return null;
          return computeDayScore({ data: f.data, points: f.points, profile, passage, sample, startIndex, durationHours }, p.weights);
        });
        // Meilleur jour : score le plus haut parmi les jours de fiabilité bonne ou moyenne.
        let best = -1;
        scores.forEach((s, i) => {
          if (s && reliability(i) !== 'low' && (best < 0 || s.score > scores[best]!.score)) best = i;
        });
        return { entry, durationHours, scores, best };
      }),
    [p.entries, p.days, p.din, p.weights, p.departureMinutes],
  );

  return (
    <section className="wview sview">
      <header className="wview-header">
        <div className="wview-title">
          <h2>Meilleur jour</h2>
          <span className="wview-track">Score de 0 à 100 par tracé, sur la durée de la rando</span>
        </div>
        <div className="wview-meta">
          <label className="sview-departure">
            Départ à{' '}
            <input type="time" step={900} value={p.departureTime} onChange={(e) => e.target.value && p.onDepartureTime(e.target.value)} />
          </label>
          <span>{MODEL_LABELS[p.model]}</span>
          <button type="button" className="btn small" onClick={p.onRefresh} disabled={p.loading}>
            {p.loading ? 'Chargement…' : 'Actualiser'}
          </button>
        </div>
      </header>

      <p className="sview-warning" role="note">
        ⚠ La fiabilité des prévisions baisse fortement au-delà de 3 à 5 jours : les jours lointains sont atténués et
        ne sont qu’une tendance. Le meilleur jour (★) n’est choisi que jusqu’à J+4.
      </p>

      {p.entries.length === 0 ? (
        <p className="wview-placeholder">Importez des tracés pour comparer les jours.</p>
      ) : (
        <div className="wtable-scroll">
          <table className="stable">
            <thead>
              <tr>
                <th scope="col" className="wt-corner">
                  Tracé
                </th>
                {p.days.map((d, i) => (
                  <th key={d} scope="col" className={`st-day rel-${reliability(i)}`} title={RELIABILITY_LABELS[reliability(i)]}>
                    {d === p.today ? 'Aujourd’hui' : dayFmt.format(new Date(`${d}T00:00Z`))}
                    {reliability(i) === 'low' && <span className="st-rel">peu fiable</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, durationHours, scores, best }) => (
                <tr key={entry.track.id}>
                  <th scope="row" className="st-track">
                    <span className="st-dot" style={{ background: entry.track.color }} />
                    <span className="st-name" title={entry.track.name}>
                      {entry.track.name}
                    </span>
                    <span className="st-sub">
                      {durationHours !== null ? formatDuration(durationHours) : '–'}
                      {entry.waiting
                        ? ' · altitudes en cours…'
                        : entry.loading && !entry.forecast
                          ? ' · chargement…'
                          : entry.error
                            ? ' · prévision indisponible'
                            : ''}
                    </span>
                  </th>
                  {scores.map((s, i) => (
                    <ScoreCell
                      key={p.days[i]}
                      score={s}
                      best={i === best}
                      reliability={reliability(i)}
                      onClick={entry.forecast ? () => p.onOpenDay(entry.track.id, p.days[i], entry.forecast!) : undefined}
                      title={entry.error ?? undefined}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="wview-footer">
        <div className="temp-legend" aria-label="Échelle des scores">
          {[0, 20, 40, 60, 80, 100].map((s) => {
            const c = scoreColor(s);
            return (
              <span key={s} style={{ background: c.bg, color: c.fg }}>
                {s}
              </span>
            );
          })}
        </div>
        <p className="wview-notes">
          Le score part de 100 et retire des points pour la pluie et l’orage (là où vous serez, à l’heure où vous y
          passerez), les rafales et la nébulosité au sommet, et le froid extrême (ressenti). Poids réglables dans ⚙
          Paramètres. Survolez une case pour le détail, cliquez pour ouvrir la météo de ce jour.
        </p>
      </footer>
    </section>
  );
}

function ScoreCell({
  score,
  best,
  reliability: rel,
  onClick,
  title,
}: {
  score: DayScore | null;
  best: boolean;
  reliability: 'good' | 'medium' | 'low';
  onClick?: () => void;
  title?: string;
}) {
  const { bg, fg } = scoreColor(score?.score ?? null);
  // Principales gênes (au moins 5 points retirés), de la plus pénalisante à la moins.
  const main = score ? [...score.penalties].filter((x) => x.points >= 5).sort((a, b) => b.points - a.points).slice(0, 3) : [];
  const detail = score
    ? [
        `Score ${score.score}/100${score.coverage < 1 ? ` (prévision partielle : ${Math.round(score.coverage * 100)} % de la rando)` : ''}`,
        ...score.penalties.map(
          (x) => `${PENALTY_ICONS[x.kind]} ${PENALTY_LABELS[x.kind]} : ${x.detail}${x.points >= 0.5 ? ` (−${Math.round(x.points)})` : ''}`,
        ),
        RELIABILITY_LABELS[rel],
      ].join('\n')
    : (title ?? 'Pas de prévision');

  return (
    <td className={`st-cell rel-${rel}${best ? ' best' : ''}${onClick ? ' clickable' : ''}`}>
      <button
        type="button"
        className="st-btn"
        style={{ background: bg, color: fg }}
        onClick={onClick}
        disabled={!onClick}
        title={detail}
        aria-label={score ? `Score ${score.score} sur 100` : 'Pas de prévision'}
      >
        <span className="st-score">
          {score ? score.score : '–'}
          {score && score.coverage < 1 && <sup>*</sup>}
        </span>
        <span className="st-icons">{main.map((x) => PENALTY_ICONS[x.kind]).join(' ')}</span>
        {best && <span className="st-star" aria-label="Meilleur jour">★</span>}
      </button>
    </td>
  );
}

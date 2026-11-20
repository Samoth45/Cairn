import { useMemo } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
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

/** Colonne des tracés, figée lors du défilement horizontal (en-tête et lignes). */
const STICKY = 'sticky left-0 z-2 h-auto border-r border-b bg-card';

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
    // En-tête, légende et notes : classes `wview-*` partagées avec la vue Météo (lot 8).
    <section className="wview">
      <header className="wview-header">
        <div className="wview-title">
          <h2>Meilleur jour</h2>
          <span className="wview-track">Score de 0 à 100 par tracé, sur la durée de la rando</span>
        </div>
        <div className="wview-meta">
          <label className="inline-flex items-center gap-1">
            Départ à
            <Input
              type="time"
              step={900}
              value={p.departureTime}
              onChange={(e) => e.target.value && p.onDepartureTime(e.target.value)}
              className="h-7 w-auto shrink-0 px-1.5 text-foreground max-md:text-sm"
            />
          </label>
          <span>{MODEL_LABELS[p.model]}</span>
          <Button variant="outline" size="sm" onClick={p.onRefresh} disabled={p.loading}>
            {p.loading ? 'Chargement…' : 'Actualiser'}
          </Button>
        </div>
      </header>

      <Alert variant="warning" role="note" className="mb-2.5 block rounded-md px-2.5 py-1.75 text-sm/snug">
        ⚠ La fiabilité des prévisions baisse fortement au-delà de 3 à 5 jours : les jours lointains sont atténués et
        ne sont qu’une tendance. Le meilleur jour (★) n’est choisi que jusqu’à J+4.
      </Alert>

      {p.entries.length === 0 ? (
        <p className="wview-placeholder">Importez des tracés pour comparer les jours.</p>
      ) : (
        // Table de shadcn (elle défile horizontalement) dans un cadre arrondi. Bordures sur les
        // cellules (border-separate, pour la colonne figée) : pas de bordure de ligne.
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table aria-label="Scores par jour" className="border-separate border-spacing-0 tabular-nums">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead scope="col" className={cn(STICKY, 'px-2.5 py-1 text-xs font-normal text-muted-foreground')}>
                  Tracé
                </TableHead>
                {p.days.map((d, i) => (
                  <TableHead
                    key={d}
                    scope="col"
                    title={RELIABILITY_LABELS[reliability(i)]}
                    className={cn(
                      'h-auto border-b px-1 py-2 text-center text-sm font-bold',
                      reliability(i) === 'medium' && 'text-muted-foreground',
                      reliability(i) === 'low' && 'text-faint italic',
                    )}
                  >
                    {d === p.today ? 'Aujourd’hui' : dayFmt.format(new Date(`${d}T00:00Z`))}
                    {reliability(i) === 'low' && <span className="block text-2xs font-normal text-muted-foreground">peu fiable</span>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child>*]:border-b-0">
              {rows.map(({ entry, durationHours, scores, best }) => (
                <TableRow key={entry.track.id} className="border-0 hover:bg-transparent">
                  <TableHead
                    scope="row"
                    className={cn(STICKY, 'max-w-60 min-w-42.5 px-2.5 py-1.5 text-center font-bold whitespace-normal max-md:max-w-37.5 max-md:min-w-30')}
                  >
                    <span className="mr-1.5 inline-block size-2.5 rounded-full align-[-1px]" style={{ background: entry.track.color }} />
                    <span className="text-sm font-semibold" title={entry.track.name}>
                      {entry.track.name}
                    </span>
                    <span className="block text-2xs">
                      {durationHours !== null ? formatDuration(durationHours) : '–'}
                      {entry.waiting
                        ? ' · altitudes en cours…'
                        : entry.loading && !entry.forecast
                          ? ' · chargement…'
                          : entry.error
                            ? ' · prévision indisponible'
                            : ''}
                    </span>
                  </TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    <TableCell className="border-b p-0.75">
      {/* Couleur du score en style en ligne (couleur de donnée). Fiabilité décroissante avec
          l'échéance : case atténuée. Meilleur jour : contour doré et étoile. */}
      <button
        type="button"
        className={cn(
          'relative flex h-13.5 w-full min-w-16 flex-col items-center justify-center gap-px rounded-md border-0 p-0 disabled:cursor-default max-md:min-w-13.5',
          'enabled:hover:outline-2 enabled:hover:-outline-offset-2 enabled:hover:outline-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          best && 'inset-ring-2 inset-ring-gold',
          rel === 'medium' && 'opacity-80',
          rel === 'low' && 'opacity-45 saturate-50',
        )}
        style={{ background: bg, color: fg }}
        onClick={onClick}
        disabled={!onClick}
        title={detail}
        aria-label={score ? `Score ${score.score} sur 100` : 'Pas de prévision'}
      >
        <span className="text-lg leading-none font-extrabold">
          {score ? score.score : '–'}
          {score && score.coverage < 1 && <sup>*</sup>}
        </span>
        <span className="min-h-[1em] text-xs">{main.map((x) => PENALTY_ICONS[x.kind]).join(' ')}</span>
        {best && (
          <span className="absolute top-0.5 right-1.25 text-sm text-gold" aria-label="Meilleur jour">
            ★
          </span>
        )}
      </button>
    </TableCell>
  );
}

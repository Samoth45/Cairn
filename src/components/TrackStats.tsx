import type { DinSpeeds, Track } from '../types';
import type { TrackStats as Stats } from '../lib/stats';
import type { ElevationStatus } from '../hooks/useElevationFetcher';
import { dinDurationHours } from '../lib/din';
import { DASH, formatCoords, formatDuration, formatKm, formatMeters, formatSlope } from '../lib/format';

interface Props {
  track: Track;
  stats: Stats;
  din: DinSpeeds;
  elevationStatus?: ElevationStatus;
  onRetryElevation: () => void;
  onShowSummit: () => void;
  onDownload: () => void;
}

export function TrackStats({ track, stats, din, elevationStatus, onRetryElevation, onShowSummit, onDownload }: Props) {
  const hasEle = stats.ascentM !== null;
  const duration = hasEle ? dinDurationHours(stats.distanceM / 1000, stats.ascentM ?? 0, stats.descentM ?? 0, din) : NaN;

  return (
    <section className="stats" aria-label="Statistiques du tracé sélectionné">
      <h2 className="stats-title" style={{ borderColor: track.color }} title={track.name}>
        {track.name}
      </h2>
      <dl className="stats-grid">
        <div>
          <dt>Distance</dt>
          <dd>{formatKm(stats.distanceM)}</dd>
        </div>
        <div>
          <dt>Durée estimée</dt>
          <dd title="Méthode DIN 33466 (vitesses réglables dans les paramètres)">{formatDuration(duration)}</dd>
        </div>
        <div>
          <dt>Dénivelé +</dt>
          <dd>{formatMeters(stats.ascentM)}</dd>
        </div>
        <div>
          <dt>Dénivelé −</dt>
          <dd>{formatMeters(stats.descentM)}</dd>
        </div>
        <div>
          <dt>Altitude min</dt>
          <dd>{formatMeters(stats.minEle)}</dd>
        </div>
        <div>
          <dt>Altitude max</dt>
          <dd>{formatMeters(stats.maxEle)}</dd>
        </div>
        <div>
          <dt title="Pente maximale sur 100 m">Pente max ↗</dt>
          <dd>{formatSlope(stats.maxSlopeUpPct, false)}</dd>
        </div>
        <div>
          <dt title="Pente maximale sur 100 m">Pente max ↘</dt>
          <dd>{formatSlope(stats.maxSlopeDownPct, false)}</dd>
        </div>
      </dl>

      <div className="stats-summit">
        <span className="stats-label">Point culminant</span>
        {stats.summit ? (
          <button type="button" className="link-btn" onClick={onShowSummit} title="Centrer la carte sur le point culminant">
            ▲ {formatMeters(stats.summit.ele)} · {formatCoords(stats.summit.lat, stats.summit.lon)}
          </button>
        ) : (
          <span>{DASH}</span>
        )}
      </div>

      <p className="stats-source">
        {elevationStatus === 'loading' ? (
          <span className="spinner-text">Récupération des altitudes…</span>
        ) : elevationStatus === 'error' ? (
          <>
            Altitudes indisponibles.{' '}
            <button type="button" className="link-btn" onClick={onRetryElevation}>
              Réessayer
            </button>
          </>
        ) : track.elevationSource === 'dem' ? (
          'Altitudes : modèle de terrain (Open-Meteo)'
        ) : (
          'Altitudes : fichier GPX'
        )}
      </p>

      <button type="button" className="btn stats-download" onClick={onDownload} disabled={elevationStatus === 'loading'}>
        ⬇ Télécharger le GPX{track.elevationSource === 'dem' ? ' (altitudes corrigées)' : ''}
      </button>
    </section>
  );
}

import { Download } from 'lucide-react';
import type { DinSpeeds, Track } from '../types';
import { Button } from '@/components/ui/button';
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
          <Button variant="link" size="inline" onClick={onShowSummit} title="Centrer la carte sur le point culminant">
            ▲ {formatMeters(stats.summit.ele)} · {formatCoords(stats.summit.lat, stats.summit.lon)}
          </Button>
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
            <Button variant="link" size="inline" onClick={onRetryElevation}>
              Réessayer
            </Button>
          </>
        ) : track.elevationSource === 'dem' ? (
          'Altitudes : modèle de terrain (Open-Meteo)'
        ) : (
          'Altitudes : fichier GPX'
        )}
      </p>

      {/* Libellé long (« altitudes corrigées ») : retour à la ligne permis, hauteur libre. */}
      <Button variant="outline" className="mt-2 h-auto min-h-8 w-full py-1.5 whitespace-normal" onClick={onDownload} disabled={elevationStatus === 'loading'}>
        <Download />
        Télécharger le GPX{track.elevationSource === 'dem' ? ' (altitudes corrigées)' : ''}
      </Button>
    </section>
  );
}

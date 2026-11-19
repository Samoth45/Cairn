import { Download } from 'lucide-react';
import type { DinSpeeds, Track } from '../types';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
import { LABEL_CAPS } from './classes';
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
    <section className="leading-tight" aria-label="Statistiques du tracé sélectionné">
      <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1.5 max-md:grid-cols-3">
        <Stat label="Distance">{formatKm(stats.distanceM)}</Stat>
        <Stat label="Durée estimée" valueTitle="Méthode DIN 33466 (vitesses réglables dans les paramètres)">
          {formatDuration(duration)}
        </Stat>
        <Stat label="Dénivelé +">{formatMeters(stats.ascentM)}</Stat>
        <Stat label="Dénivelé −">{formatMeters(stats.descentM)}</Stat>
        <Stat label="Altitude min">{formatMeters(stats.minEle)}</Stat>
        <Stat label="Altitude max">{formatMeters(stats.maxEle)}</Stat>
        <Stat label="Pente max ↗" labelTitle="Pente maximale sur 100 m">
          {formatSlope(stats.maxSlopeUpPct, false)}
        </Stat>
        <Stat label="Pente max ↘" labelTitle="Pente maximale sur 100 m">
          {formatSlope(stats.maxSlopeDownPct, false)}
        </Stat>
      </dl>

      <div className="mt-2 flex flex-col gap-0.5 text-sm/tight">
        <span className={LABEL_CAPS}>Point culminant</span>
        {stats.summit ? (
          <Button variant="link" size="inline" onClick={onShowSummit} title="Centrer la carte sur le point culminant">
            ▲ {formatMeters(stats.summit.ele)} · {formatCoords(stats.summit.lat, stats.summit.lon)}
          </Button>
        ) : (
          <span>{DASH}</span>
        )}
      </div>

      <p className="mt-2 mb-0 text-xs text-muted-foreground">
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

/** Une statistique : libellé en capitales, valeur en gras (chiffres alignés). */
function Stat({ label, labelTitle, valueTitle, children }: { label: string; labelTitle?: string; valueTitle?: string; children: ReactNode }) {
  return (
    <div>
      <dt className={LABEL_CAPS} title={labelTitle}>
        {label}
      </dt>
      <dd className="m-0 text-base/tight font-semibold tabular-nums" title={valueTitle}>
        {children}
      </dd>
    </div>
  );
}

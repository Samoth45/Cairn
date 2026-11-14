import type { ReactNode } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { useHoverPoint, type HoverPoint } from '../hooks/useHoverPoint';

interface Props {
  color: string;
  /** Contenu d'une infobulle affichée au point survolé (heure de passage…), ou null. */
  renderInfo?: (p: HoverPoint) => ReactNode | null;
}

/** Marqueur à la position survolée (profil altimétrique ou tracé sur la carte). */
export function HoverMarker({ color, renderInfo }: Props) {
  const p = useHoverPoint();
  if (!p) return null;
  const info = renderInfo?.(p) ?? null;
  return (
    <CircleMarker
      center={[p.lat, p.lon]}
      radius={7}
      // `interactive` doit être une option de création : dans `pathOptions`, react-leaflet
      // l'applique après l'ajout à la carte (setStyle) et le cercle reste cliquable. Il
      // passerait alors sous la souris et « volerait » le survol du tracé (bug visible en
      // production uniquement : en dev, le StrictMode réinsère la couche une seconde fois).
      interactive={false}
      pathOptions={{ color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 }}
    >
      {info && (
        <Tooltip permanent direction="top" offset={[0, -8]} className="wx-tooltip-wrap">
          {info}
        </Tooltip>
      )}
    </CircleMarker>
  );
}

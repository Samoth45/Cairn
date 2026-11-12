import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { Bounds } from '../lib/geo';

export interface FitRequest {
  bounds: Bounds;
  /** Change à chaque demande, pour pouvoir re-zoomer sur la même emprise. */
  nonce: number;
}

/**
 * Zoome la carte sur l'emprise demandée. Si la carte est masquée (onglet Météo),
 * la demande est appliquée au prochain affichage (`active` repasse à true).
 */
export function FitBounds({ request, active }: { request: FitRequest | null; active: boolean }) {
  const map = useMap();
  const applied = useRef(0);
  useEffect(() => {
    if (!request || !active || request.nonce === applied.current) return;
    if (map.getContainer().clientWidth === 0) return;
    map.invalidateSize();
    map.flyToBounds(request.bounds, { padding: [40, 40], maxZoom: 16, duration: 0.6 });
    applied.current = request.nonce;
  }, [map, request, active]);
  return null;
}

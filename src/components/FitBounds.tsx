import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { Bounds } from '../lib/geo';

export interface FitRequest {
  bounds: Bounds;
  /** Change à chaque demande, pour pouvoir re-zoomer sur la même emprise. */
  nonce: number;
}

/** Zoome la carte sur l'emprise demandée. */
export function FitBounds({ request }: { request: FitRequest | null }) {
  const map = useMap();
  useEffect(() => {
    if (!request) return;
    map.invalidateSize();
    map.flyToBounds(request.bounds, { padding: [40, 40], maxZoom: 16, duration: 0.6 });
  }, [map, request]);
  return null;
}

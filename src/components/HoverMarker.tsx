import { CircleMarker } from 'react-leaflet';
import { useHoverPoint } from '../hooks/useHoverPoint';

/** Marqueur sur la carte à la position survolée dans le profil altimétrique. */
export function HoverMarker({ color }: { color: string }) {
  const p = useHoverPoint();
  if (!p) return null;
  return (
    <CircleMarker
      center={[p.lat, p.lon]}
      radius={7}
      pathOptions={{ color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1, interactive: false }}
    />
  );
}

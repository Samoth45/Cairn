import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  ZoomControl,
  ScaleControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { BaseLayerId, Track } from '../types';
import type { Bounds } from '../lib/geo';
import type { TrackStats } from '../lib/stats';
import { formatMeters } from '../lib/format';
import { FitBounds, type FitRequest } from './FitBounds';
import { HoverMarker } from './HoverMarker';

/** Recalcule la taille de la carte quand son conteneur change (profil affiché / masqué). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

const BASE_LAYERS: Record<BaseLayerId, { name: string; url: string; attribution: string; maxZoom: number; maxNativeZoom: number; subdomains?: string }> = {
  ign: {
    name: 'Plan IGN',
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    attribution: '© <a href="https://www.ign.fr/" target="_blank" rel="noopener">IGN</a>',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  otm: {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      '© <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a>, © contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    maxZoom: 19,
    maxNativeZoom: 17,
    subdomains: 'abc',
  },
};

const NAME_TO_ID: Record<string, BaseLayerId> = Object.fromEntries(
  (Object.keys(BASE_LAYERS) as BaseLayerId[]).map((id) => [BASE_LAYERS[id].name, id]),
);

function BaseLayerWatcher({ onChange }: { onChange: (id: BaseLayerId) => void }) {
  useMapEvents({
    baselayerchange: (e) => {
      const id = NAME_TO_ID[e.name];
      if (id) onChange(id);
    },
  });
  return null;
}

interface Props {
  tracks: Track[];
  selectedId?: string;
  baseLayer: BaseLayerId;
  initialBounds: Bounds | null;
  fitRequest: FitRequest | null;
  /** Point culminant du tracé sélectionné. */
  summit: TrackStats['summit'];
  onSelect: (id: string) => void;
  onBaseLayerChange: (id: BaseLayerId) => void;
}

type LatLngs = Array<Array<[number, number]>>;

const FRANCE_CENTER: [number, number] = [46.6, 2.5];

export function MapView({ tracks, selectedId, baseLayer, initialBounds, fitRequest, summit, onSelect, onBaseLayerChange }: Props) {
  // Rendu canvas : performant avec de nombreux tracés, tolérance pour cliquer facilement au doigt.
  const renderer = useMemo(() => L.canvas({ tolerance: 8 }), []);
  // Coordonnées converties une fois par version de tracé (évite de redessiner pour rien).
  const latLngs = useMemo(() => {
    const m = new Map<string, LatLngs>();
    for (const t of tracks) m.set(t.id, t.segments.map((seg) => seg.map(([lat, lon]) => [lat, lon] as [number, number])));
    return m;
  }, [tracks]);
  const selectedColor = tracks.find((t) => t.id === selectedId)?.color ?? '#e6194b';

  const visible = tracks.filter((t) => t.visible);
  // Le tracé sélectionné est dessiné en dernier pour passer au premier plan.
  const ordered = [...visible.filter((t) => t.id !== selectedId), ...visible.filter((t) => t.id === selectedId)];

  return (
    <MapContainer
      className="map"
      center={FRANCE_CENTER}
      zoom={6}
      bounds={initialBounds ?? undefined}
      boundsOptions={{ padding: [30, 30] }}
      zoomControl={false}
      renderer={renderer}
      worldCopyJump
    >
      <LayersControl position="topright">
        {(Object.keys(BASE_LAYERS) as BaseLayerId[]).map((id) => {
          const l = BASE_LAYERS[id];
          return (
            <LayersControl.BaseLayer key={id} name={l.name} checked={baseLayer === id}>
              <TileLayer
                url={l.url}
                attribution={l.attribution}
                maxZoom={l.maxZoom}
                maxNativeZoom={l.maxNativeZoom}
                {...(l.subdomains ? { subdomains: l.subdomains } : {})}
              />
            </LayersControl.BaseLayer>
          );
        })}
      </LayersControl>
      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomleft" imperial={false} />
      <BaseLayerWatcher onChange={onBaseLayerChange} />
      <FitBounds request={fitRequest} />
      <AutoResize />

      {ordered.map((t) => {
        const selected = t.id === selectedId;
        const positions = latLngs.get(t.id) ?? [];
        // Chaque tracé est entouré d'un liseré (sombre puis blanc) pour ressortir
        // sur n'importe quel fond, quelle que soit sa couleur.
        return [
          <Polyline
            key={`${t.id}-shadow`}
            positions={positions}
            pathOptions={{
              color: '#000000',
              weight: selected ? 13 : 9,
              opacity: selected ? 0.45 : 0.3,
              interactive: false,
            }}
          />,
          <Polyline
            key={`${t.id}-halo`}
            positions={positions}
            pathOptions={{ color: '#ffffff', weight: selected ? 10 : 7, opacity: 1, interactive: false }}
          />,
          <Polyline
            key={t.id}
            positions={positions}
            pathOptions={{ color: t.color, weight: selected ? 6 : 4, opacity: 1 }}
            eventHandlers={{ click: () => onSelect(t.id) }}
          />,
        ];
      })}

      {summit && selectedId && visible.some((t) => t.id === selectedId) && (
        <CircleMarker
          center={[summit.lat, summit.lon]}
          radius={6}
          pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: '#22292f', fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            Point culminant · {formatMeters(summit.ele)}
          </Tooltip>
        </CircleMarker>
      )}
      <HoverMarker color={selectedColor} />
    </MapContainer>
  );
}

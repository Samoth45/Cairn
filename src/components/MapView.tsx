import { useEffect, useMemo, type ReactNode } from 'react';
import type { ColoredRun } from '../lib/trackForecast';
import type { HoverPoint } from '../hooks/useHoverPoint';
import L from 'leaflet';
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Pane,
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
import type { WeatherPoint } from '../lib/weatherPoints';
import type { CachedForecast } from '../db/db';
import { WeatherPointTooltip } from './WeatherPointTooltip';
import { FitBounds, type FitRequest } from './FitBounds';
import { HoverMarker } from './HoverMarker';

/** Clic sur le fond de carte (ferme l'infobulle de passage ouverte au doigt). */
function MapClickWatcher({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick });
  return null;
}

/** Calque des marqueurs (sommet, points météo, survol du profil), au-dessus des tracés. */
const MARKERS_PANE = 'cairn-markers';

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
  /** Points de prévision météo du tracé sélectionné. */
  weatherPoints: WeatherPoint[];
  /** Prévision chargée et heure affichée dans le panneau météo (pour les infobulles). */
  forecast: CachedForecast | null;
  hourIndex: number | null;
  nightHour: boolean;
  /** false quand la carte est masquée (onglet Météo). */
  active: boolean;
  /** Tronçons colorés du tracé sélectionné selon la prévision (null : couleur du tracé). */
  forecastRuns: ColoredRun[] | null;
  onTrackHover: (lat: number, lon: number) => void;
  onTrackLeave: () => void;
  /** Infobulle au point survolé (heure de passage et météo), ou null. */
  hoverInfo?: (p: HoverPoint) => ReactNode | null;
  onSelect: (id: string) => void;
  onBaseLayerChange: (id: BaseLayerId) => void;
}

type LatLngs = Array<Array<[number, number]>>;

const FRANCE_CENTER: [number, number] = [46.6, 2.5];

export function MapView({
  tracks,
  selectedId,
  baseLayer,
  initialBounds,
  fitRequest,
  summit,
  weatherPoints,
  forecast,
  hourIndex,
  nightHour,
  active,
  forecastRuns,
  onTrackHover,
  onTrackLeave,
  hoverInfo,
  onSelect,
  onBaseLayerChange,
}: Props) {
  // Rendu canvas : performant avec de nombreux tracés, tolérance pour cliquer facilement au doigt.
  const renderer = useMemo(() => L.canvas({ tolerance: 8 }), []);
  // Coordonnées converties une fois par version de tracé (évite de redessiner pour rien).
  const latLngs = useMemo(() => {
    const m = new Map<string, LatLngs>();
    for (const t of tracks) m.set(t.id, t.segments.map((seg) => seg.map(([lat, lon]) => [lat, lon] as [number, number])));
    return m;
  }, [tracks]);
  const selectedColor = tracks.find((t) => t.id === selectedId)?.color ?? '#e6194b';

  /** Point météo situé exactement au point culminant (rôle « Sommet »), s'il existe. */
  const summitWeatherPoint = summit
    ? weatherPoints.find((p) => p.roles.includes('summit') && p.lat === summit.lat && p.lon === summit.lon)
    : undefined;

  /** Météo d'un point à l'heure affichée, si la prévision chargée correspond aux points actuels. */
  const weatherAt = (p: WeatherPoint) => {
    const i = forecast ? forecast.points.findIndex((fp) => fp.lat === p.lat && fp.lon === p.lon && fp.ele === p.ele) : -1;
    if (!forecast || i < 0 || hourIndex === null) return {};
    return { series: forecast.data.points[i], time: forecast.data.times[hourIndex], index: hourIndex };
  };

  const visible = tracks.filter((t) => t.visible);
  const showSelected = !!selectedId && visible.some((t) => t.id === selectedId);
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
      {/* En bas à droite : le coin inférieur gauche accueille le panneau de prévision. */}
      <ScaleControl position="bottomright" imperial={false} />
      <BaseLayerWatcher onChange={onBaseLayerChange} />
      <MapClickWatcher onClick={onTrackLeave} />
      <FitBounds request={fitRequest} active={active} />
      <AutoResize />

      {ordered.map((t) => {
        const selected = t.id === selectedId;
        const positions = latLngs.get(t.id) ?? [];
        // Chaque tracé est entouré d'un liseré (sombre puis blanc) pour ressortir
        // sur n'importe quel fond, quelle que soit sa couleur.
        // Tracé sélectionné coloré selon la prévision : liseré sombre (les couleurs proches du
        // blanc, comme 0 °C, resteraient invisibles sur un liseré blanc) et tronçons colorés.
        const colored = selected && forecastRuns;
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
            key={`${t.id}-halo${colored ? '-dark' : ''}`}
            positions={positions}
            pathOptions={{
              color: colored ? '#263238' : '#ffffff',
              weight: selected ? 10 : 7,
              opacity: 1,
              interactive: false,
            }}
          />,
          colored ? (
            forecastRuns.map((run, k) => (
              <Polyline
                key={`${t.id}-run-${k}-${run.color}`}
                positions={run.positions}
                pathOptions={{ color: run.color, weight: 6, opacity: 1, lineCap: 'butt' }}
                eventHandlers={{
                  mousemove: (e) => onTrackHover(e.latlng.lat, e.latlng.lng),
                  mouseout: () => onTrackLeave(),
                  // Au doigt : un appui affiche l'infobulle (pas de nouveau zoom).
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    onTrackHover(e.latlng.lat, e.latlng.lng);
                  },
                }}
              />
            ))
          ) : (
            <Polyline
              key={t.id}
              positions={positions}
              pathOptions={{ color: t.color, weight: selected ? 6 : 4, opacity: 1 }}
              eventHandlers={{ click: () => onSelect(t.id) }}
            />
          ),
        ];
      })}

      {/* Calque dédié au-dessus des tracés : sinon un tracé ajouté après un marqueur
          (import, réaffichage) le recouvre. */}
      <Pane name={MARKERS_PANE} style={{ zIndex: 450 }}>
      {showSelected &&
        weatherPoints.map((p) => {
          // Le point météo du sommet est fusionné avec le marqueur « Point culminant » (même position) :
          // sinon ce dernier, dessiné par-dessus, masquerait son infobulle.
          if (p === summitWeatherPoint) return null;
          return (
            <CircleMarker
              key={`wx-${p.lat}-${p.lon}`}
              center={[p.lat, p.lon]}
              radius={5}
              pathOptions={{ color: '#22292f', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -5]} className="wx-tooltip-wrap">
                <WeatherPointTooltip point={p} {...weatherAt(p)} night={nightHour} />
              </Tooltip>
            </CircleMarker>
          );
        })}

      {summit && showSelected && (
        <CircleMarker
          center={[summit.lat, summit.lon]}
          radius={6}
          pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: '#22292f', fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -6]} className="wx-tooltip-wrap">
            {summitWeatherPoint ? (
              <WeatherPointTooltip
                point={summitWeatherPoint}
                title="Point culminant"
                {...weatherAt(summitWeatherPoint)}
                night={nightHour}
              />
            ) : (
              <>Point culminant · {formatMeters(summit.ele)}</>
            )}
          </Tooltip>
        </CircleMarker>
      )}
      <HoverMarker color={selectedColor} renderInfo={hoverInfo} />
      </Pane>
    </MapContainer>
  );
}

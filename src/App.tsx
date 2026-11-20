import { useCallback, useMemo, useRef, useState } from 'react';
import { useTracks } from './hooks/useTracks';
import { useElevationFetcher } from './hooks/useElevationFetcher';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { TrackStats } from './components/TrackStats';
import { TrackPanel } from './components/TrackPanel';
import { ElevationProfile } from './components/ElevationProfile';
import { SettingsDialog } from './components/SettingsDialog';
import { analyzeTrack, nearestProfileIndex } from './lib/stats';
import { needsElevation } from './lib/elevation';
import { selectWeatherPoints } from './lib/weatherPoints';
import { useWeather } from './hooks/useWeather';
import { WeatherPanel } from './components/WeatherPanel';
import { WeatherView } from './components/WeatherView';
import { resolveHourIndex, type HourSelection } from './lib/forecast';
import { isNightHour, parisMinutes, sunTimes } from './lib/sun';
import { dinDurationHours } from './lib/din';
import {
  coloredRuns,
  departureIndex,
  makeWeatherSampler,
  nearestProfileIndexByLatLng,
  parseClock,
  passageHours,
} from './lib/trackForecast';
import { forecastDays, TABLE_FIRST_HOUR, TABLE_LAST_HOUR } from './lib/weatherTable';
import { nextDays, parisHourKey } from './lib/time';
import { useAllForecasts } from './hooks/useAllForecasts';
import { SummaryView } from './components/SummaryView';
import type { CachedForecast } from './db/db';
import { setHoverPoint, type HoverPoint } from './hooks/useHoverPoint';
import { ForecastControl, type PassageSummary } from './components/ForecastControl';
import { PassageTooltip } from './components/PassageTooltip';
import { buildGpx, gpxFileName } from './lib/gpxExport';
import { downloadText } from './lib/download';
import { DropZone } from './components/DropZone';
import { Toasts, type Toast } from './components/Toasts';
import { CairnLogo } from './components/CairnLogo';
import { Map as MapIcon, Mountain, Star, Thermometer, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { MAP_CONTROL } from './components/classes';
import type { FitRequest } from './components/FitBounds';
import { trackBounds, type Bounds } from './lib/geo';
import type { Track } from './types';
import { useTheme } from './hooks/useTheme';
import { toggledTheme } from './lib/theme';

const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

/** Onglets principaux ; les libellés servent aussi d'aria-label (icônes seules sur mobile). */
const VIEW_TABS: Array<{ id: 'map' | 'weather' | 'summary'; label: string; icon: LucideIcon }> = [
  { id: 'map', label: 'Carte', icon: MapIcon },
  { id: 'weather', label: 'Météo', icon: Thermometer },
  { id: 'summary', label: 'Meilleur jour', icon: Star },
];

function boundsOf(tracks: Track[]): Bounds | null {
  return trackBounds(tracks.flatMap((t) => t.segments));
}

export default function App() {
  const {
    tracks,
    settings,
    loading,
    importGpxFiles,
    renameTrack,
    setTrackColor,
    setTrackVisible,
    deleteTrack,
    setSettings,
  } = useTracks();
  const theme = useTheme(settings?.theme);

  const [panelOpen, setPanelOpen] = useState(false);
  const [fitRequest, setFitRequest] = useState<FitRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  // Emprise initiale de la carte, fixée au premier rendu chargé (undefined = pas encore).
  const [initialBounds, setInitialBounds] = useState<Bounds | null | undefined>(undefined);

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const pushToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = ++toastId.current;
      setToasts((ts) => [...ts, { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), toast.kind === 'error' ? 12000 : 5000);
    },
    [dismissToast],
  );

  const fitTo = useCallback((bounds: Bounds | null) => {
    if (bounds) setFitRequest({ bounds, nonce: Date.now() });
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Vue principale : carte ou tableau météo par altitude. */
  const [mainView, setMainView] = useState<'map' | 'weather' | 'summary'>('map');
  const openWeatherView = useCallback(() => {
    setMainView('weather');
    if (isMobile()) setPanelOpen(false);
  }, []);

  const onElevationError = useCallback(
    (track: Track, message: string) =>
      pushToast({ kind: 'error', title: `Altitudes non récupérées pour « ${track.name} »`, details: [message] }),
    [pushToast],
  );
  const { elevationStatus, retryElevation } = useElevationFetcher(tracks, onElevationError);

  const selectedTrack = tracks?.find((t) => t.id === settings?.selectedTrackId);
  const analysis = useMemo(() => (selectedTrack ? analyzeTrack(selectedTrack.segments) : null), [selectedTrack]);

  // Points de prévision : seulement une fois les altitudes définitives connues.
  const selectedNeedsElevation = selectedTrack ? needsElevation(selectedTrack) : false;
  const weatherPoints = useMemo(
    () => (analysis && !selectedNeedsElevation ? selectWeatherPoints(analysis.profile) : []),
    [analysis, selectedNeedsElevation],
  );
  const weatherModel = settings?.weatherModel ?? 'meteofrance_seamless';
  const weather = useWeather(selectedTrack?.id, weatherPoints, weatherModel);

  // Heure affichée dans le panneau météo, partagée avec les infobulles de la carte.
  const [hourSelection, setHourSelection] = useState<HourSelection | null>(null);
  const forecast = weather.forecast;
  const hourIndex = forecast ? resolveHourIndex(forecast.data.times, forecast.key, hourSelection) : null;

  const start = analysis?.profile[0] ?? null;
  const durationHours =
    analysis && settings && analysis.stats.ascentM !== null
      ? dinDurationHours(analysis.stats.distanceM / 1000, analysis.stats.ascentM, analysis.stats.descentM ?? 0, settings.din)
      : null;
  // ---------- Étape 6 : prévisions de tous les tracés (vue « Meilleur jour ») ----------
  const summaryOpen = mainView === 'summary' && (tracks?.length ?? 0) > 0;
  const allForecasts = useAllForecasts(tracks, weatherModel, summaryOpen);

  // ---------- Étape 5 : prévision le long du tracé à l'heure de passage ----------
  const coloring = settings?.trackColoring ?? 'none';
  const [departureDayChoice, setDepartureDayChoice] = useState<string | null>(null);
  const forecastDayList = useMemo(() => (forecast ? forecastDays(forecast.data.times) : []), [forecast]);
  const todayKey = parisHourKey().slice(0, 10);
  // Jour de départ : choix explicite s'il est couvert, sinon le jour affiché dans le panneau météo.
  const departureDay =
    departureDayChoice && forecastDayList.includes(departureDayChoice)
      ? departureDayChoice
      : forecast && hourIndex !== null
        ? forecast.data.times[hourIndex].slice(0, 10)
        : todayKey;
  // Mémoïsés (comme `startIndex` et `departureSun`) : dépendances des useMemo / useCallback
  // ci-dessous, sans quoi la règle `preserve-manual-memoization` les signale.
  const departureTime = settings?.departureTime ?? '';
  const departureMinutes = useMemo(() => parseClock(departureTime) ?? 8 * 60, [departureTime]);
  const din = settings?.din;
  const passage = useMemo(
    () => (analysis && din ? passageHours(analysis.profile, din, durationHours) : null),
    [analysis, din, durationHours],
  );
  const sampler = useMemo(() => (forecast ? makeWeatherSampler(forecast.data, forecast.points) : null), [forecast]);
  const startIndex = useMemo(
    () => (forecast ? departureIndex(forecast.data.times, departureDay, departureMinutes) : null),
    [forecast, departureDay, departureMinutes],
  );
  const forecastRuns = useMemo(() => {
    if (coloring === 'none' || !analysis || !passage || !sampler || startIndex === null || selectedNeedsElevation) return null;
    return coloredRuns(analysis.profile, passage, sampler, startIndex, coloring);
  }, [coloring, analysis, passage, sampler, startIndex, selectedNeedsElevation]);

  const departureSun = useMemo(
    () => (start ? sunTimes(departureDay, start.lat, start.lon) : null),
    [departureDay, start],
  );
  const passageSummary: PassageSummary | null =
    forecast && startIndex !== null && durationHours !== null
      ? {
          departureMinutes,
          durationHours,
          beyondForecast: startIndex + durationHours > forecast.data.times.length - 1,
          sunset: departureSun?.sunset ?? null,
          afterSunset:
            !!departureSun?.sunset && departureMinutes + durationHours * 60 > parisMinutes(departureSun.sunset),
        }
      : null;

  /** Survol du tracé coloré : on se cale sur le point du profil le plus proche. */
  const onTrackHover = useCallback(
    (lat: number, lon: number) => {
      if (!analysis) return;
      const i = nearestProfileIndexByLatLng(analysis.profile, lat, lon);
      if (i >= 0) setHoverPoint({ lat: analysis.profile[i].lat, lon: analysis.profile[i].lon, d: analysis.profile[i].d });
    },
    [analysis],
  );
  const onTrackLeave = useCallback(() => setHoverPoint(null), []);

  /** Infobulle de passage (survol du tracé coloré ou du profil). */
  const hoverInfo = useCallback(
    (p: HoverPoint) => {
      if (!forecastRuns || !analysis || !passage || !sampler || startIndex === null || p.d === undefined) return null;
      const i = nearestProfileIndex(analysis.profile, p.d);
      if (i < 0) return null;
      const point = analysis.profile[i];
      const clockMinutes = departureMinutes + passage[i] * 60;
      const night =
        !!departureSun?.sunrise &&
        !!departureSun.sunset &&
        (clockMinutes < parisMinutes(departureSun.sunrise) || clockMinutes > parisMinutes(departureSun.sunset));
      return (
        <PassageTooltip
          info={{
            clockMinutes,
            elapsedHours: passage[i],
            ele: point.ele,
            sample: point.ele === null ? null : sampler(point.ele, startIndex + passage[i]),
            night,
          }}
        />
      );
    },
    [forecastRuns, analysis, passage, sampler, startIndex, departureMinutes, departureSun],
  );

  const nightHour = useMemo(() => {
    if (!forecast || hourIndex === null || !start) return false;
    const time = forecast.data.times[hourIndex];
    return isNightHour(time, sunTimes(time.slice(0, 10), start.lat, start.lon));
  }, [forecast, hourIndex, start]);

  const selectTrack = useCallback(
    (id: string) => {
      const track = tracks?.find((t) => t.id === id);
      if (!track) return;
      void setSettings({ selectedTrackId: id });
      if (!track.visible) void setTrackVisible(id, true);
      fitTo(trackBounds(track.segments));
      if (isMobile()) setPanelOpen(false);
    },
    [tracks, setSettings, setTrackVisible, fitTo],
  );

  const handleImportGpx = useCallback(
    async (files: File[]) => {
      try {
        const { added, errors } = await importGpxFiles(files);
        if (added.length) {
          pushToast({
            kind: 'success',
            title: added.length === 1 ? `Tracé importé : ${added[0].name}` : `${added.length} tracés importés`,
          });
          if (added.length === 1) void setSettings({ selectedTrackId: added[0].id });
          fitTo(boundsOf(added));
          if (isMobile()) setPanelOpen(false);
        }
        if (errors.length) {
          pushToast({
            kind: 'error',
            title: errors.length === 1 ? "Un fichier n'a pas pu être importé" : `${errors.length} fichiers n'ont pas pu être importés`,
            details: errors,
          });
        }
      } catch (e) {
        console.error(e);
        pushToast({ kind: 'error', title: "Erreur lors de l'import des fichiers" });
      }
    },
    [importGpxFiles, pushToast, setSettings, fitTo],
  );

  const handleDownloadGpx = useCallback(
    (track: Track) => {
      try {
        downloadText(buildGpx(track), gpxFileName(track.name), 'application/gpx+xml');
      } catch (e) {
        console.error(e);
        pushToast({ kind: 'error', title: `Échec du téléchargement de « ${track.name} »` });
      }
    },
    [pushToast],
  );

  if (loading || !tracks || !settings) {
    return (
      <div className="loading">
        <CairnLogo size={48} />
        <p>Chargement…</p>
      </div>
    );
  }

  // Emprise initiale calculée une seule fois au démarrage (mise à jour d'état pendant le rendu,
  // motif recommandé par React : le rendu repart aussitôt avec la valeur, avant affichage).
  if (initialBounds === undefined) {
    const selected = tracks.find((t) => t.id === settings.selectedTrackId && t.visible);
    setInitialBounds(selected ? trackBounds(selected.segments) : boundsOf(tracks.filter((t) => t.visible)));
    return null;
  }

  const selElevationStatus = selectedTrack ? elevationStatus[selectedTrack.id] : undefined;
  // Sans tracé sélectionné, l'onglet Météo n'a pas de sens ; sans tracé du tout, le
  // comparatif non plus : retour à la carte.
  const view =
    (mainView === 'weather' && !selectedTrack) || (mainView === 'summary' && tracks.length === 0) ? 'map' : mainView;

  /** Clic sur une case du comparatif : météo de ce tracé, ce jour-là, à l'heure de départ. */
  const openTrackDay = (trackId: string, day: string, dayForecast: CachedForecast) => {
    selectTrack(trackId);
    const hour = Math.min(TABLE_LAST_HOUR, Math.max(TABLE_FIRST_HOUR, Math.floor(departureMinutes / 60)));
    const index = dayForecast.data.times.indexOf(`${day}T${String(hour).padStart(2, '0')}:00`);
    if (index >= 0) setHourSelection({ key: dayForecast.key, index });
    setDepartureDayChoice(day);
    setMainView('weather');
  };
  const showProfile = Boolean(selectedTrack && analysis && selectedTrack.visible);

  return (
    <div className="app">
      <Sidebar
        open={panelOpen}
        tracks={tracks}
        selectedId={settings.selectedTrackId}
        trackPanel={
          selectedTrack && (
            <TrackPanel
              track={selectedTrack}
              tab={settings.sidePanelTab}
              onTabChange={(tab) => void setSettings({ sidePanelTab: tab })}
              stats={
                analysis && (
                  <TrackStats
                    track={selectedTrack}
                    stats={analysis.stats}
                    din={settings.din}
                    elevationStatus={selElevationStatus}
                    onRetryElevation={() => retryElevation(selectedTrack.id)}
                    onDownload={() => handleDownloadGpx(selectedTrack)}
                    onShowSummit={() => {
                      const s = analysis.stats.summit;
                      if (s) fitTo([[s.lat, s.lon], [s.lat, s.lon]]);
                      if (isMobile()) setPanelOpen(false);
                    }}
                  />
                )
              }
              weather={
                <WeatherPanel
                  key={selectedTrack.id}
                  weather={weather}
                  model={weatherModel}
                  waitingForElevation={selectedNeedsElevation}
                  start={start}
                  durationHours={durationHours}
                  hourIndex={hourIndex}
                  onSelectHour={setHourSelection}
                  onOpenTable={view === 'weather' ? undefined : () => openWeatherView()}
                />
              }
            />
          )
        }
        onOpenSettings={() => setSettingsOpen(true)}
        theme={theme}
        onToggleTheme={() => void setSettings({ theme: toggledTheme(theme) })}
        onClose={() => setPanelOpen(false)}
        onImportGpx={handleImportGpx}
        onSelect={selectTrack}
        onRename={(id, name) => void renameTrack(id, name)}
        onColor={(id, c) => void setTrackColor(id, c)}
        onToggle={(id, v) => void setTrackVisible(id, v)}
        onDelete={(id) => void deleteTrack(id)}
        onDownload={handleDownloadGpx}
      />
      {/* Mobile : fond grisé sous le tiroir ouvert (un clic le ferme), bouton d'ouverture. */}
      {panelOpen && <div className="fixed inset-0 z-backdrop bg-black/30 md:hidden" onClick={() => setPanelOpen(false)} />}

      <main className="map-wrap">
        <button
          type="button"
          className={cn(MAP_CONTROL, 'top-2.5 left-2.5 flex items-center gap-2 rounded-full border-0 py-1.5 pr-3 pl-2 font-semibold md:hidden')}
          onClick={() => setPanelOpen(true)}
          aria-label="Ouvrir la liste des tracés"
        >
          <CairnLogo size={22} />
          <span>Cairn</span>
          <Badge variant="muted">{tracks.length}</Badge>
        </button>
        {/* Onglets principaux (Tabs de Radix, sans TabsContent : les vues sont rendues plus bas).
            Activation manuelle (Entrée / Espace) : les flèches ne changent pas de vue à chaque
            pas. Centrés en haut ; sur mobile, à droite du bouton « Cairn », icônes seules. */}
        <Tabs value={view} onValueChange={(v) => setMainView(v as typeof mainView)} activationMode="manual" className="contents">
          <TabsList
            variant="pill"
            aria-label="Vue"
            className={cn(
              MAP_CONTROL,
              'top-2.5 left-1/2 z-map-tabs w-auto -translate-x-1/2 border-0 max-md:right-14.5 max-md:left-auto max-md:translate-x-0',
            )}
          >
            {VIEW_TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                aria-label={t.label}
                disabled={t.id === 'weather' ? !selectedTrack : t.id === 'summary' ? tracks.length === 0 : false}
                title={
                  t.id === 'weather'
                    ? selectedTrack
                      ? 'Météo par altitude du tracé sélectionné'
                      : 'Sélectionnez un tracé'
                    : t.id === 'summary'
                      ? 'Comparer les tracés jour par jour (score « meilleur jour »)'
                      : undefined
                }
                // Infobulle (title) visible même désactivé ; pas de clic possible (bouton désactivé).
                className="px-3.5 py-1 disabled:pointer-events-auto disabled:cursor-default max-md:px-3 max-md:py-1.5"
              >
                <t.icon />
                <span className="max-md:hidden">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {view === 'summary' && (
          <SummaryView
            entries={allForecasts.entries}
            days={nextDays(todayKey, 7)}
            today={todayKey}
            model={weatherModel}
            din={settings.din}
            weights={settings.scoreWeights}
            departureTime={settings.departureTime}
            departureMinutes={departureMinutes}
            loading={allForecasts.loading}
            onDepartureTime={(t) => void setSettings({ departureTime: t })}
            onRefresh={allForecasts.refresh}
            onOpenDay={openTrackDay}
          />
        )}

        {view === 'weather' && selectedTrack && (
          <WeatherView
            trackName={selectedTrack.name}
            weather={weather}
            model={weatherModel}
            waitingForElevation={selectedNeedsElevation}
            start={start}
            hourIndex={hourIndex}
            onSelectHour={setHourSelection}
          />
        )}

        {/* La carte reste montée (état, tuiles) mais est masquée dans l'onglet Météo. */}
        <div className="map-area" hidden={view !== 'map'}>
          <MapView
            active={view === 'map'}
            tracks={tracks}
            selectedId={settings.selectedTrackId}
            baseLayer={settings.baseLayer}
            initialBounds={initialBounds}
            fitRequest={fitRequest}
            summit={analysis?.stats.summit ?? null}
            weatherPoints={weatherPoints}
            forecast={forecast}
            hourIndex={hourIndex}
            nightHour={nightHour}
            forecastRuns={forecastRuns}
            onTrackHover={onTrackHover}
            onTrackLeave={onTrackLeave}
            hoverInfo={hoverInfo}
            onSelect={selectTrack}
            onBaseLayerChange={(id) => void setSettings({ baseLayer: id })}
          />
          {showProfile && forecast && !selectedNeedsElevation && (
            <ForecastControl
              coloring={coloring}
              onColoring={(c) => void setSettings({ trackColoring: c })}
              days={forecastDayList}
              today={todayKey}
              day={departureDay}
              onDay={setDepartureDayChoice}
              departureTime={settings.departureTime}
              onDepartureTime={(t) => void setSettings({ departureTime: t })}
              summary={passageSummary}
            />
          )}
          {showProfile && !settings.showProfile && (
            // En haut à gauche ; sur mobile, sous le bouton « Cairn ».
            <Button
              variant="ghost"
              className={cn(MAP_CONTROL, 'top-2.5 left-2.5 h-auto rounded-full px-3.5 py-1.5 font-semibold text-foreground max-md:top-15')}
              onClick={() => void setSettings({ showProfile: true })}
            >
              <Mountain />
              Profil
            </Button>
          )}
        </div>
        {view === 'map' && showProfile && settings.showProfile && selectedTrack && analysis && (
          <ElevationProfile
            name={selectedTrack.name}
            color={selectedTrack.color}
            profile={analysis.profile}
            placeholder={
              selElevationStatus === 'loading'
                ? 'Récupération des altitudes…'
                : selElevationStatus === 'error'
                  ? 'Altitudes indisponibles'
                  : undefined
            }
            onClose={() => void setSettings({ showProfile: false })}
          />
        )}
      </main>

      {settingsOpen && (
        <SettingsDialog
          din={settings.din}
          weatherModel={settings.weatherModel}
          scoreWeights={settings.scoreWeights}
          theme={settings.theme}
          onSave={(patch) => void setSettings(patch)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <DropZone onFiles={handleImportGpx} />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

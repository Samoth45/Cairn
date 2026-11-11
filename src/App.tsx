import { useCallback, useRef, useState } from 'react';
import { useTracks } from './hooks/useTracks';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { DropZone } from './components/DropZone';
import { Toasts, type Toast } from './components/Toasts';
import { CairnLogo } from './components/CairnLogo';
import type { FitRequest } from './components/FitBounds';
import { trackBounds, type Bounds } from './lib/geo';
import { backupFileName, BackupError } from './lib/backup';
import type { Track } from './types';

const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

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
    exportBackup,
    importBackup,
  } = useTracks();

  const [panelOpen, setPanelOpen] = useState(false);
  const [fitRequest, setFitRequest] = useState<FitRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const initialBounds = useRef<Bounds | null | undefined>(undefined);

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

  const handleExport = useCallback(async () => {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      pushToast({ kind: 'success', title: `Sauvegarde exportée (${backup.tracks.length} tracés)` });
    } catch (e) {
      console.error(e);
      pushToast({ kind: 'error', title: "Échec de l'export de la sauvegarde" });
    }
  }, [exportBackup, pushToast]);

  const handleImportBackup = useCallback(
    async (file: File) => {
      try {
        const { added, skipped } = await importBackup(await file.text());
        const parts = [`${added} ajouté${added > 1 ? 's' : ''}`];
        if (skipped) parts.push(`${skipped} déjà présent${skipped > 1 ? 's' : ''}`);
        pushToast({ kind: 'success', title: `Sauvegarde importée : ${parts.join(', ')}` });
      } catch (e) {
        if (!(e instanceof BackupError)) console.error(e);
        pushToast({
          kind: 'error',
          title: 'Sauvegarde non importée',
          details: [`${file.name} : ${e instanceof BackupError ? e.message : 'erreur inattendue'}`],
        });
      }
    },
    [importBackup, pushToast],
  );

  if (loading || !tracks || !settings) {
    return (
      <div className="loading">
        <CairnLogo size={48} />
        <p>Chargement…</p>
      </div>
    );
  }

  // Emprise initiale calculée une seule fois au démarrage.
  if (initialBounds.current === undefined) {
    const selected = tracks.find((t) => t.id === settings.selectedTrackId && t.visible);
    initialBounds.current = selected ? trackBounds(selected.segments) : boundsOf(tracks.filter((t) => t.visible));
  }

  return (
    <div className="app">
      <Sidebar
        open={panelOpen}
        tracks={tracks}
        selectedId={settings.selectedTrackId}
        onClose={() => setPanelOpen(false)}
        onImportGpx={handleImportGpx}
        onExportBackup={handleExport}
        onImportBackup={handleImportBackup}
        onSelect={selectTrack}
        onRename={(id, name) => void renameTrack(id, name)}
        onColor={(id, c) => void setTrackColor(id, c)}
        onToggle={(id, v) => void setTrackVisible(id, v)}
        onDelete={(id) => void deleteTrack(id)}
      />
      {panelOpen && <div className="backdrop" onClick={() => setPanelOpen(false)} />}

      <main className="map-wrap">
        <button type="button" className="panel-toggle" onClick={() => setPanelOpen(true)} aria-label="Ouvrir la liste des tracés">
          <CairnLogo size={22} />
          <span>Cairn</span>
          <span className="count">{tracks.length}</span>
        </button>
        <MapView
          tracks={tracks}
          selectedId={settings.selectedTrackId}
          baseLayer={settings.baseLayer}
          initialBounds={initialBounds.current}
          fitRequest={fitRequest}
          onSelect={selectTrack}
          onBaseLayerChange={(id) => void setSettings({ baseLayer: id })}
        />
      </main>

      <DropZone onFiles={handleImportGpx} />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

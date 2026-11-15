import { useRef, type ReactNode } from 'react';
import type { Track } from '../types';
import { TrackItem } from './TrackItem';
import { CairnLogo } from './CairnLogo';

interface Props {
  open: boolean;
  tracks: Track[];
  selectedId?: string;
  /** Statistiques du tracé sélectionné. */
  statsPanel?: ReactNode;
  /** Météo du tracé sélectionné. */
  weatherPanel?: ReactNode;
  onClose: () => void;
  onOpenSettings: () => void;
  onImportGpx: (files: File[]) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onColor: (id: string, color: string) => void;
  onToggle: (id: string, visible: boolean) => void;
  onDelete: (id: string) => void;
  onDownload: (track: Track) => void;
}

export function Sidebar(p: Props) {
  const gpxInput = useRef<HTMLInputElement>(null);

  return (
    <aside className={`sidebar${p.open ? ' open' : ''}`} aria-label="Tracés">
      <header className="sidebar-header">
        <CairnLogo />
        <h1>Cairn</h1>
        <button type="button" className="icon-btn" onClick={p.onOpenSettings} aria-label="Paramètres" title="Paramètres">
          ⚙
        </button>
        <button type="button" className="icon-btn close-panel" onClick={p.onClose} aria-label="Fermer le panneau">
          ✕
        </button>
      </header>

      <div className="sidebar-actions">
        <button type="button" className="btn primary" onClick={() => gpxInput.current?.click()}>
          Importer des GPX
        </button>
        <input
          ref={gpxInput}
          type="file"
          accept=".gpx,application/gpx+xml"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) p.onImportGpx(files);
          }}
        />
      </div>

      <div className="sidebar-scroll">
      {p.statsPanel}
      {p.weatherPanel}

      <div className="track-list-header">
        <span>Tracés</span>
        <span className="count">{p.tracks.length}</span>
      </div>

      {p.tracks.length === 0 ? (
        <p className="empty">
          Aucun tracé pour l'instant.
          <br />
          Glissez-déposez vos fichiers GPX sur la carte ou utilisez le bouton « Importer des GPX ».
        </p>
      ) : (
        <ul className="track-list">
          {p.tracks.map((t) => (
            <TrackItem
              key={t.id}
              track={t}
              selected={t.id === p.selectedId}
              onSelect={() => p.onSelect(t.id)}
              onRename={(name) => p.onRename(t.id, name)}
              onColor={(c) => p.onColor(t.id, c)}
              onToggle={(v) => p.onToggle(t.id, v)}
              onDelete={() => p.onDelete(t.id)}
              onDownload={() => p.onDownload(t)}
            />
          ))}
        </ul>
      )}
      </div>
    </aside>
  );
}

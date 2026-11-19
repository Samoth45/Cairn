import { useRef, type ReactNode } from 'react';
import type { Track } from '../types';
import { TrackItem } from './TrackItem';
import { CairnLogo } from './CairnLogo';
import { IconButton } from './IconButton';
import { Moon, Settings, Sun, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  tracks: Track[];
  selectedId?: string;
  /** Panneau à onglets (Stats | Météo) du tracé sélectionné. */
  trackPanel?: ReactNode;
  onClose: () => void;
  onOpenSettings: () => void;
  /** Thème affiché, et bascule clair / sombre. */
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
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
        <IconButton
          onClick={p.onToggleTheme}
          aria-label={p.theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          title={p.theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {p.theme === 'dark' ? <Sun /> : <Moon />}
        </IconButton>
        <IconButton onClick={p.onOpenSettings} aria-label="Paramètres" title="Paramètres">
          <Settings />
        </IconButton>
        <IconButton className="md:hidden" onClick={p.onClose} aria-label="Fermer le panneau">
          <X />
        </IconButton>
      </header>

      <div className="sidebar-actions">
        <Button size="lg" className="w-full" onClick={() => gpxInput.current?.click()}>
          Importer des GPX
        </Button>
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
      {p.trackPanel}

      <div className="track-list-header">
        <span>Tracés</span>
        <Badge variant="muted">{p.tracks.length}</Badge>
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

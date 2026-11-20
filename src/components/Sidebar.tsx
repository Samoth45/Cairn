import { useRef, type ReactNode } from 'react';
import type { Track } from '../types';
import { TrackItem } from './TrackItem';
import { CairnLogo } from './CairnLogo';
import { IconButton } from './IconButton';
import { Moon, Settings, Sun, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    // Panneau fixe à gauche ; sur mobile, tiroir qui glisse depuis la gauche (data-open).
    <aside
      data-open={p.open}
      aria-label="Tracés"
      className={cn(
        'z-sidebar flex w-(--sidebar-w) shrink-0 flex-col border-r bg-card',
        'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[min(88vw,var(--sidebar-w))] max-md:-translate-x-full max-md:shadow-drawer max-md:transition-transform max-md:duration-200 max-md:ease-in-out max-md:data-[open=true]:translate-x-0',
      )}
    >
      <header className="flex items-center gap-2.5 border-b px-4 py-3.5">
        <CairnLogo />
        <h1 className="m-0 flex-1 text-xl/tight font-bold tracking-wide">Cairn</h1>
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

      <div className="px-4 py-3">
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

      {/* Zone défilante : panneau du tracé sélectionné, puis liste des tracés. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      {p.trackPanel}

      <div className="flex items-center justify-between px-4 pt-1 pb-1.5 text-xs tracking-wider text-muted-foreground uppercase">
        <span>Tracés</span>
        <Badge variant="muted">{p.tracks.length}</Badge>
      </div>

      {p.tracks.length === 0 ? (
        <p className="my-3.5 p-4 text-sm/normal text-muted-foreground">
          Aucun tracé pour l'instant.
          <br />
          Glissez-déposez vos fichiers GPX sur la carte ou utilisez le bouton « Importer des GPX ».
        </p>
      ) : (
        <ul className="m-0 list-none px-2 pt-0 pb-2">
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

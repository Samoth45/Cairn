import { useEffect, useRef, useState } from 'react';
import { Download, Pencil, Trash2 } from 'lucide-react';
import type { Track } from '../types';
import { IconButton } from './IconButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  track: Track;
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onToggle: (visible: boolean) => void;
  onDelete: () => void;
  onDownload: () => void;
}

export function TrackItem({ track, selected, onSelect, onRename, onColor, onToggle, onDelete, onDownload }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    setDraft(track.name);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== track.name) onRename(draft);
  };

  return (
    // Tracé sélectionné : fond `accent` et liseré vert à gauche (pas de survol par-dessus).
    <li
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 max-md:p-2',
        selected ? 'bg-accent shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-background',
      )}
    >
      <Checkbox
        checked={track.visible}
        onCheckedChange={(v) => onToggle(v === true)}
        title={track.visible ? 'Masquer le tracé' : 'Afficher le tracé'}
        aria-label={track.visible ? `Masquer ${track.name}` : `Afficher ${track.name}`}
        className="size-4.5"
      />
      {/* Pastille de couleur : le sélecteur natif, invisible, la recouvre. */}
      <label
        className="relative size-4.5 shrink-0 cursor-pointer rounded-full border-2 border-card ring-1 ring-border has-focus-visible:ring-2 has-focus-visible:ring-ring"
        title="Changer la couleur"
        style={{ background: track.color }}
      >
        <input
          type="color"
          value={track.color}
          onChange={(e) => onColor(e.target.value)}
          aria-label={`Couleur de ${track.name}`}
          className="absolute inset-0 m-0 size-full cursor-pointer p-0 opacity-0"
        />
      </label>

      {editing ? (
        <Input
          ref={inputRef}
          className="h-8 min-w-0 flex-1 border-primary px-1.5"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="Nouveau nom du tracé"
        />
      ) : (
        <button
          type="button"
          className={cn(
            'min-w-0 flex-1 truncate border-0 bg-transparent px-0.5 py-1.5 text-left',
            !track.visible && 'text-muted-foreground',
          )}
          onClick={onSelect}
          onDoubleClick={startEdit}
          title={`${track.name}\n${track.fileName}\n(double-clic pour renommer)`}
        >
          {track.name}
        </button>
      )}

      <IconButton onClick={startEdit} title="Renommer" aria-label={`Renommer ${track.name}`}>
        <Pencil />
      </IconButton>
      <IconButton
        onClick={onDownload}
        title={track.elevationSource === 'dem' ? 'Télécharger le GPX (altitudes corrigées)' : 'Télécharger le GPX'}
        aria-label={`Télécharger ${track.name} en GPX`}
      >
        <Download />
      </IconButton>
      <IconButton
        className="hover:text-destructive"
        onClick={() => {
          if (window.confirm(`Supprimer le tracé « ${track.name} » ?`)) onDelete();
        }}
        title="Supprimer"
        aria-label={`Supprimer ${track.name}`}
      >
        <Trash2 />
      </IconButton>
    </li>
  );
}

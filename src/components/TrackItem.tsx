import { useEffect, useRef, useState } from 'react';
import { Download, Pencil, Trash2 } from 'lucide-react';
import type { Track } from '../types';
import { IconButton } from './IconButton';

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
    <li className={`track-item${selected ? ' selected' : ''}${track.visible ? '' : ' hidden-track'}`}>
      <input
        type="checkbox"
        className="track-toggle"
        checked={track.visible}
        onChange={(e) => onToggle(e.target.checked)}
        title={track.visible ? 'Masquer le tracé' : 'Afficher le tracé'}
        aria-label={track.visible ? `Masquer ${track.name}` : `Afficher ${track.name}`}
      />
      <label className="track-color" title="Changer la couleur" style={{ background: track.color }}>
        <input
          type="color"
          value={track.color}
          onChange={(e) => onColor(e.target.value)}
          aria-label={`Couleur de ${track.name}`}
        />
      </label>

      {editing ? (
        <input
          ref={inputRef}
          className="track-name-input"
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
          className="track-name"
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

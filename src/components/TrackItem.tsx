import { useEffect, useRef, useState } from 'react';
import type { Track } from '../types';

interface Props {
  track: Track;
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onToggle: (visible: boolean) => void;
  onDelete: () => void;
}

export function TrackItem({ track, selected, onSelect, onRename, onColor, onToggle, onDelete }: Props) {
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

      <button type="button" className="icon-btn" onClick={startEdit} title="Renommer" aria-label={`Renommer ${track.name}`}>
        ✎
      </button>
      <button
        type="button"
        className="icon-btn danger"
        onClick={() => {
          if (window.confirm(`Supprimer le tracé « ${track.name} » ?`)) onDelete();
        }}
        title="Supprimer"
        aria-label={`Supprimer ${track.name}`}
      >
        🗑
      </button>
    </li>
  );
}

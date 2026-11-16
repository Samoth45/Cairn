import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { SidePanelTab, Track } from '../types';

interface Props {
  track: Track;
  tab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  stats: ReactNode;
  weather: ReactNode;
}

const TABS: Array<{ id: SidePanelTab; text: string; label: string }> = [
  // aria-label distinct des onglets principaux (« Météo ») pour ne pas les confondre.
  { id: 'stats', text: 'Stats', label: 'Stats du tracé' },
  { id: 'weather', text: 'Météo', label: 'Météo du tracé' },
];

/**
 * Panneau du tracé sélectionné (barre latérale) : nom du tracé puis onglets Stats | Météo.
 * Les deux contenus restent montés (l'inactif est masqué) pour conserver leur état.
 */
export function TrackPanel({ track, tab, onTabChange, stats, weather }: Props) {
  const refs = useRef<Partial<Record<SidePanelTab, HTMLButtonElement | null>>>({});

  // Flèches ← → (et Début / Fin) : passer à l'autre onglet et lui donner le focus.
  const onKeyDown = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next: number;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    onTabChange(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };

  return (
    <section className="track-panel" aria-label="Tracé sélectionné">
      <h2 className="track-panel-title" style={{ borderColor: track.color }} title={track.name}>
        {track.name}
      </h2>
      <div className="track-panel-tabs" role="tablist" aria-label="Détails du tracé" onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`track-tab-${t.id}`}
            aria-label={t.label}
            aria-selected={tab === t.id}
            aria-controls={`track-tabpanel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'active' : ''}
            onClick={() => onTabChange(t.id)}
          >
            {t.text}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`track-tabpanel-${t.id}`}
          aria-labelledby={`track-tab-${t.id}`}
          className="track-panel-body"
          hidden={tab !== t.id}
        >
          {t.id === 'stats' ? stats : weather}
        </div>
      ))}
    </section>
  );
}

import type { ReactNode } from 'react';
import type { SidePanelTab, Track } from '../types';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
 * Panneau du tracé sélectionné (barre latérale) : nom du tracé puis onglets Stats | Météo
 * (Tabs de Radix : flèches ← →, Début, Fin). L'onglet choisi est persisté (`sidePanelTab`).
 * Les deux contenus restent montés (`forceMount`, l'inactif est masqué) pour garder leur état.
 */
export function TrackPanel({ track, tab, onTabChange, stats, weather }: Props) {
  return (
    <Card
      size="sm"
      aria-label="Tracé sélectionné"
      className="mx-3 mb-2.5 gap-0 overflow-visible rounded-lg border bg-background px-3 py-2.5 ring-0"
      role="region"
    >
      <h2
        className="m-0 mb-2 truncate border-0 border-l-4 border-solid pl-2 text-base/tight font-bold"
        style={{ borderColor: track.color }}
        title={track.name}
      >
        {track.name}
      </h2>
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as SidePanelTab)} className="gap-2.5">
        <TabsList variant="pill" aria-label="Détails du tracé">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} aria-label={t.label}>
              {t.text}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} forceMount className="data-[state=inactive]:hidden">
            {t.id === 'stats' ? stats : weather}
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}

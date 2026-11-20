// Combinaisons de classes Tailwind partagées par plusieurs composants (spec migration UI §3.3 :
// une combinaison qui revient au moins 3 fois est factorisée). À passer à cn() si besoin.

/** Petit libellé en capitales, discret (en-têtes de statistiques, de colonnes…). */
export const LABEL_CAPS = 'text-2xs uppercase tracking-wider text-muted-foreground';

/** Seconde ligne discrète sous une valeur (rôle d'un point, ressenti, rafales). */
export const SUB_LINE = 'block text-2xs text-muted-foreground';

/** Contrôle posé sur la carte (onglets de vue, panneau de coloration, bouton « Profil ») :
 *  fond carte, ombre légère, au-dessus des contrôles de Leaflet. Position et arrondi en plus. */
export const MAP_CONTROL = 'absolute z-map-control bg-card shadow-float';

/** Contenu des infobulles météo de la carte (point météo, passage sur le tracé). */
export const TIP = {
  root: 'text-sm leading-snug tabular-nums',
  title: 'text-sm',
  /** Ligne secondaire (heure, altitude). */
  hour: 'mb-0.5 text-xs text-muted-foreground',
  /** Icône météo + température. */
  main: 'mb-0.5 flex items-center gap-1.5',
  icon: 'text-2xl leading-none',
  temp: 'text-base',
  sub: 'text-xs text-muted-foreground',
} as const;

/** Écran plein, contenu centré (chargement de l'application, erreur fatale). */
export const FULL_SCREEN_MESSAGE =
  'flex h-dvh flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground';

/** Petit cercle qui tourne, placé devant un texte de chargement (`aria-hidden`). */
export const SPINNER =
  'mr-1.5 inline-block size-2.25 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent align-[-1px]';

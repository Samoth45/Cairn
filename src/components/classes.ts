// Combinaisons de classes Tailwind partagées par plusieurs composants (spec migration UI §3.3 :
// une combinaison qui revient au moins 3 fois est factorisée). À passer à cn() si besoin.

/** Petit libellé en capitales, discret (en-têtes de statistiques, de colonnes…). */
export const LABEL_CAPS = 'text-2xs uppercase tracking-wider text-muted-foreground';

/** Seconde ligne discrète sous une valeur (rôle d'un point, ressenti, rafales). */
export const SUB_LINE = 'block text-2xs text-muted-foreground';

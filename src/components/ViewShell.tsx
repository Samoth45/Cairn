import type { ReactNode } from 'react';

/**
 * Habillage commun des vues plein écran « Météo » et « Meilleur jour » (lot 8 de
 * docs/specs/migration-ui.md, anciennes classes `wview-*`) : zone défilante, en-tête, message
 * d'attente, légende de couleurs et notes.
 */

/** Zone défilante de la vue (le haut laisse la place aux onglets posés sur la vue). */
export function ViewSection({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-background px-5 pt-14.5 pb-5 max-md:px-2.5 max-md:pb-3.5">
      {children}
    </section>
  );
}

/** Titre et sous-titre à gauche ; à droite, informations et actions (`children`). */
export function ViewHeader({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <header className="mb-2.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
      <div>
        <h2 className="m-0 text-xl/tight font-bold">{title}</h2>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">{children}</div>
    </header>
  );
}

/** Message à la place du contenu (attente, erreur, aucun tracé). */
export function ViewPlaceholder({ children }: { children: ReactNode }) {
  return <p className="my-4 py-10 text-center text-muted-foreground">{children}</p>;
}

/** Bas de vue : échelle de couleurs (couleurs de données en style en ligne) puis notes. */
export function ViewFooter({
  legendLabel,
  legend,
  children,
}: {
  legendLabel: string;
  legend: Array<{ key: number; label: string; bg: string; fg: string }>;
  children: ReactNode;
}) {
  return (
    <footer className="mt-2.5">
      <div className="inline-flex overflow-hidden rounded-md text-2xs tabular-nums" aria-label={legendLabel}>
        {legend.map((l) => (
          <span key={l.key} className="px-1.5 py-0.5" style={{ background: l.bg, color: l.fg }}>
            {l.label}
          </span>
        ))}
      </div>
      <p className="mt-1.5 mb-0 text-xs/normal text-muted-foreground">{children}</p>
    </footer>
  );
}

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './IconButton';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  details?: string[];
}

/** Notifications maison (pas de Sonner, spec Q6) : en haut à droite, toute la largeur sur
 *  mobile, sous le bouton « Cairn ». Fermeture auto gérée par App (5 s, 12 s pour une erreur). */
export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="fixed top-16 right-3 z-toast flex max-w-105 flex-col gap-2 max-md:inset-x-3 max-md:top-15 max-md:max-w-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-2 rounded-md border-l-4 border-solid bg-card py-2.5 pr-2.5 pl-3.5 text-sm shadow-overlay',
            t.kind === 'error' ? 'border-destructive' : 'border-primary',
          )}
        >
          <div className="min-w-0 flex-1">
            <strong className="font-semibold">{t.title}</strong>
            {t.details && t.details.length > 0 && (
              // Liste d'erreurs d'import : défile au-delà de 30 % de la hauteur d'écran.
              <ul className="mt-1.5 mb-0 max-h-[30vh] list-disc overflow-y-auto pl-4.5 wrap-anywhere text-muted-foreground">
                {t.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
          <IconButton onClick={() => onDismiss(t.id)} aria-label="Fermer">
            <X />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

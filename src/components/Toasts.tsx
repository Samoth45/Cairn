import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  details?: string[];
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="toast-body">
            <strong>{t.title}</strong>
            {t.details && t.details.length > 0 && (
              <ul>
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

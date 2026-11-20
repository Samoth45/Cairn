import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FULL_SCREEN_MESSAGE } from './classes';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur inattendue', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className={FULL_SCREEN_MESSAGE}>
          <h1 className="my-2 text-2xl font-bold">Cairn a rencontré un problème</h1>
          <p className="my-2">Vos tracés sont conservés. Rechargez la page pour continuer.</p>
          <pre className="my-2 max-w-full text-xs whitespace-pre-wrap">{this.state.error.message}</pre>
          <Button size="lg" onClick={() => window.location.reload()}>
            Recharger
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

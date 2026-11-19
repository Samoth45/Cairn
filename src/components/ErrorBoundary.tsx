import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

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
        <div className="fatal">
          <h1>Cairn a rencontré un problème</h1>
          <p>Vos tracés sont conservés. Rechargez la page pour continuer.</p>
          <pre>{this.state.error.message}</pre>
          <Button size="lg" onClick={() => window.location.reload()}>
            Recharger
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

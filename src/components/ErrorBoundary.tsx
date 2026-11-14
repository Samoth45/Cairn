import { Component, type ErrorInfo, type ReactNode } from 'react';

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
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

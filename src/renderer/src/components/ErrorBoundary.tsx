// Si la interfaz falla, el usuario no pierde su trabajo: se escribe la copia de recuperación al
// momento y se ofrece reintentar o volver al inicio (donde aparece para recuperarla).
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useApp } from '../state/app-store';

interface State {
  error: Error | null;
  saved: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, saved: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[interfaz]', error.message, info.componentStack);
    const doc = useApp.getState().doc;
    if (doc?.dirty)
      window.dw.writeRecovery(doc.project).then(
        () => this.setState({ saved: true }),
        () => undefined,
      );
  }

  override render(): ReactNode {
    const { error, saved } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="crash" role="alert">
        <AlertTriangle size={32} aria-hidden />
        <h1>Algo ha fallado</h1>
        <p>
          Dra-Wings ha encontrado un error inesperado.{' '}
          {saved
            ? 'Tus cambios están a salvo en la copia de recuperación.'
            : 'Si tenías cambios sin guardar, podrás recuperarlos desde la pantalla de inicio.'}
        </p>
        <details>
          <summary>Detalles técnicos</summary>
          <code>{error.message}</code>
        </details>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={() => this.setState({ error: null, saved: false })}>
            Volver a intentar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              useApp.getState().closeDoc();
              this.setState({ error: null, saved: false });
            }}
          >
            Ir al inicio
          </button>
        </div>
      </main>
    );
  }
}

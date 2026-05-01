import React from 'react';
import { errorTracker } from '../utils/errorTracking';

interface Props {
  /** Layer name surfaced en telemetría (`ProviderErrorBoundary:<name>`) y en la UI fallback. */
  name: string;
  children: React.ReactNode;
  /** Custom fallback. Recibe error + retry; si se omite, renderiza el panel por defecto. */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
  /** Bumped por `retry()`. Se aplica como key del Fragment hijo para forzar re-mount completo. */
  resetKey: number;
}

/**
 * Error boundary granular para el árbol de providers en index.tsx.
 *
 * Sin este, cualquier excepción durante el render/init de un provider
 * la captura el RootErrorBoundary, mostrando un crash genérico que no
 * dice qué subsistema falló. Con este, cada capa reporta su error con
 * contexto propio (`ProviderErrorBoundary:<name>`) y ofrece retry sin
 * tener que recargar la app.
 */
export class ProviderErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    errorTracker.captureException(error, {
      module: `ProviderErrorBoundary:${this.props.name}`,
      extra: { componentStack: info.componentStack },
    });
  }

  retry = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    const { error, resetKey } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.retry);
      return <ProviderErrorPanel name={this.props.name} error={error} onRetry={this.retry} />;
    }
    // key={resetKey} sobre Fragment fuerza re-mount completo de los hijos al hacer retry.
    return <React.Fragment key={resetKey}>{this.props.children}</React.Fragment>;
  }
}

interface PanelProps {
  name: string;
  error: Error;
  onRetry: () => void;
}

function ProviderErrorPanel({ name, error, onRetry }: PanelProps) {
  // Inline styles deliberados: el UIProvider puede ser justo el que falló,
  // así que no podemos confiar en variables CSS del design system para
  // estar disponibles. Fallbacks defensivos en cada propiedad.
  return (
    <div
      role="alert"
      style={{
        background: 'var(--nfq-bg-base, #0e0e0e)',
        color: 'var(--nfq-text-primary, #fafafa)',
        padding: '32px',
        fontFamily: 'Inter, system-ui, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: 720, width: '100%', marginTop: 64 }}>
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--nfq-text-faint, #6b7280)',
          }}
        >
          {name} subsystem failed
        </div>
        <h1 style={{ marginTop: 12, marginBottom: 16, fontSize: 22, fontWeight: 600 }}>
          The {name.toLowerCase()} layer could not initialize
        </h1>
        <p
          style={{
            color: 'var(--nfq-text-muted, #9ca3af)',
            marginBottom: 16,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          The rest of the application depends on this layer. Retry to re-mount it,
          or reload the app to clear cached state.
        </p>
        <pre
          style={{
            background: 'var(--nfq-bg-surface, #1a1a1a)',
            border: '1px solid var(--nfq-border-ghost, rgba(255,255,255,0.08))',
            borderRadius: 10,
            padding: 16,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'var(--nfq-text-muted, #9ca3af)',
            marginBottom: 24,
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {error.message}
        </pre>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: '10px 20px',
              background: 'var(--nfq-accent, #F48B4A)',
              color: '#0e0e0e',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: 'var(--nfq-text-primary, #fafafa)',
              border: '1px solid var(--nfq-border-ghost, rgba(255,255,255,0.16))',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    </div>
  );
}

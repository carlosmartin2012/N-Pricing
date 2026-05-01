import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import './index.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { EntityProvider } from './contexts/EntityContext';
import { MarketDataProvider } from './contexts/MarketDataContext';
import { GovernanceProvider } from './contexts/GovernanceContext';
import { DataProvider } from './contexts/DataContext';
import { UIProvider } from './contexts/UIContext';
import { WalkthroughProvider } from './contexts/WalkthroughContext';
import { ToastProvider } from './components/ui/Toast';
import { ProviderErrorBoundary } from './components/ProviderErrorBoundary';
import { errorTracker } from './utils/errorTracking';

// ---------------------------------------------------------------------------
// React Query client — shared cache for all data fetching
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — market data refreshes frequently
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** Top-level error boundary that shows a visible crash report instead of black screen */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    errorTracker.captureException(error, {
      module: 'RootErrorBoundary',
      extra: { componentStack: info.componentStack },
    });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#111', color: '#f87171', padding: 40, fontFamily: 'monospace', minHeight: '100vh' }}>
          <h1 style={{ color: '#fff', marginBottom: 16 }}>Application Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.6 }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: 24, padding: '12px 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
          >
            Clear Storage &amp; Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Error tracking: init + global handlers
// ---------------------------------------------------------------------------
errorTracker.init({
  environment: import.meta.env.MODE,
});

window.onerror = (_message, _source, _lineno, _colno, error) => {
  if (error) {
    errorTracker.captureException(error, { module: 'window.onerror' });
  }
};

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const error = event.reason instanceof Error
    ? event.reason
    : new Error(String(event.reason));
  errorTracker.captureException(error, { module: 'unhandledrejection' });
};


const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
if (!googleClientId) {
  console.warn('VITE_GOOGLE_CLIENT_ID not set. Google OAuth will not work.');
}

// Granular error boundaries por provider — un fallo en (p.ej.) MarketData
// ya no presenta el crash genérico de root: la UI dice "Market Data
// subsystem failed", reporta a errorTracker con módulo específico, y
// permite retry sin recarga. Orden de anidado preservado: cada capa
// depende de la anterior (Auth → Entity → MarketData → Governance →
// Data → UI → Walkthrough).
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <HashRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ProviderErrorBoundary name="Auth">
              <AuthProvider>
                <ProviderErrorBoundary name="Entity">
                  <EntityProvider>
                    <ProviderErrorBoundary name="Market Data">
                      <MarketDataProvider>
                        <ProviderErrorBoundary name="Governance">
                          <GovernanceProvider>
                            <ProviderErrorBoundary name="Data">
                              <DataProvider>
                                <ProviderErrorBoundary name="UI">
                                  <UIProvider>
                                    <ProviderErrorBoundary name="Walkthrough">
                                      <WalkthroughProvider>
                                        <App />
                                      </WalkthroughProvider>
                                    </ProviderErrorBoundary>
                                  </UIProvider>
                                </ProviderErrorBoundary>
                              </DataProvider>
                            </ProviderErrorBoundary>
                          </GovernanceProvider>
                        </ProviderErrorBoundary>
                      </MarketDataProvider>
                    </ProviderErrorBoundary>
                  </EntityProvider>
                </ProviderErrorBoundary>
              </AuthProvider>
            </ProviderErrorBoundary>
          </ToastProvider>
        </QueryClientProvider>
      </HashRouter>
    </RootErrorBoundary>
  </React.StrictMode>
);

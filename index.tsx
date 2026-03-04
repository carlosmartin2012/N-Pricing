import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { UIProvider } from './contexts/UIContext';

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
    console.error('[RootErrorBoundary]', error, info.componentStack);
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

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
if (!googleClientId) {
  console.warn('VITE_GOOGLE_CLIENT_ID not set. Google OAuth will not work.');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId || 'NOT_CONFIGURED'}>
        <AuthProvider>
          <DataProvider>
            <UIProvider>
              <App />
            </UIProvider>
          </DataProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </RootErrorBoundary>
  </React.StrictMode>
);

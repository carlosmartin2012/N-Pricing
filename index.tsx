import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { UIProvider } from './contexts/UIContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
if (!googleClientId) {
  console.warn('VITE_GOOGLE_CLIENT_ID not set. Google OAuth will not work.');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId || ''}>
      <AuthProvider>
        <DataProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </DataProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

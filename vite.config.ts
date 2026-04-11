/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
      server: {
        // Port 5000 is macOS AirPlay — use 5173 (Vite default) instead.
        port: 5173,
        host: '0.0.0.0',
        allowedHosts: true,
        watch: {
          ignored: ['**/screenshots/**', '**/test-results/**', '**/playwright-report/**'],
        },
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            bypass(req) {
              const url = req.url ?? '';
              if (/\.(tsx?|jsx?|css|json|png|svg|ico|woff2?)(\?.*)?$/.test(url)) {
                return url;
              }
            },
          },
        },
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'robots.txt'],
          manifest: {
            name: 'N-Pricing — FTP Engine',
            short_name: 'N-Pricing',
            description: 'Funds Transfer Pricing platform for financial institutions',
            theme_color: '#0e0e0e',
            background_color: '#0e0e0e',
            display: 'standalone',
            orientation: 'landscape',
            scope: '/',
            start_url: '/',
            icons: [
              { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'supabase-api-cache',
                  expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
                  networkTimeoutSeconds: 10,
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
        }),
      ],
      build: {
        sourcemap: true,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-supabase': ['@supabase/supabase-js'],
              'vendor-recharts': ['recharts'],
            },
          },
        },
      },
      /* define block removed — Gemini calls now go through /api/gemini/chat server proxy */
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./utils/__tests__/setup-dom.ts'],
        exclude: ['e2e/**', 'node_modules/**'],
      },
    };
});

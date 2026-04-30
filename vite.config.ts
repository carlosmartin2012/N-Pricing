/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
      server: {
        // Port 5000 maps to external 80 in Replit (.replit [[ports]] section).
        // This is the port the Replit preview and autoscale deployment expect.
        port: 5000,
        strictPort: true,
        host: '0.0.0.0',
        allowedHosts: true,
        watch: {
          ignored: [
            '**/.local/**',
            '**/screenshots/**',
            '**/test-results/**',
            '**/playwright-report/**',
          ],
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
              // Antes: NetworkFirst con `maxAgeSeconds: 86400` cacheaba
              // respuestas autenticadas de Supabase REST en el SW. En
              // dispositivos compartidos (sucursal, kiosko) el siguiente
              // usuario podía leer datos del anterior offline sin
              // autenticarse — el caché no estaba keyed por usuario ni
              // por sesión.
              //
              // Ahora: NetworkOnly (sin storage). Las respuestas de la
              // API REST autenticada NO se cachean. Si la app pierde
              // conectividad, el cliente decide qué mostrar (estado
              // local, mensajes "offline"). Mejor un error explícito
              // que un dato del usuario equivocado.
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
                handler: 'NetworkOnly',
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
              'vendor-react': ['react', 'react-dom', 'react-router'],
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
        coverage: {
          provider: 'v8',
          reporter: ['text-summary', 'html', 'lcov'],
          reportsDirectory: './coverage',
          // Measure only code we actually ship or that drives pricing logic.
          // Exclude tests, stories, integration harnesses, generated artefacts
          // and a few demo-only scaffolds that have no runtime value.
          include: [
            'api/**/*.{ts,tsx}',
            'components/**/*.{ts,tsx}',
            'contexts/**/*.{ts,tsx}',
            'hooks/**/*.{ts,tsx}',
            'integrations/**/*.{ts,tsx}',
            'server/**/*.ts',
            'utils/**/*.{ts,tsx}',
            'types/**/*.ts',
            'App.tsx',
            'appNavigation.ts',
          ],
          exclude: [
            '**/__tests__/**',
            '**/*.test.{ts,tsx}',
            '**/*.stories.{ts,tsx}',
            '**/*.d.ts',
            'e2e/**',
            'dist/**',
            'storybook-static/**',
            'coverage/**',
            'playwright-report/**',
            'scripts/**',
            'supabase/functions/**',
            'node_modules/**',
            // Generated / static content with no behavioural code:
            'translations.ts',
            'appSummaries.ts',
            'utils/seedData.ts',
          ],
          // Anti-regression thresholds calibrated against the 2026-04-18
          // baseline (lines 23.68 / statements 23.46 / functions 18.85 /
          // branches 21.09). Set ~1 pp below the measured values so a
          // single regressing PR fails CI before the debt compounds.
          // These are NOT aspirational targets — they are floors. Raise
          // them intentionally as coverage grows; never lower them to
          // make a broken build pass. A follow-up ticket should push the
          // UI component tests up to 40% before bumping.
          thresholds: {
            lines: 22,
            statements: 22,
            functions: 17,
            branches: 20,
          },
        },
      },
    };
});

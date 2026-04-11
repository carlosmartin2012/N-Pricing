import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use `dev:vite` (not `dev`) — the full `dev` script runs vite + the
    // Express API via `concurrently`, and when the API crashes on a missing
    // DATABASE_URL it also tears down vite, leaving Playwright with no
    // server. The e2e specs only exercise the frontend, so we can boot
    // vite in isolation and let the app fall back to its offline/mock
    // data path.
    command:
      'VITE_DEMO_USER=demo VITE_DEMO_PASS=demo VITE_DEMO_EMAIL=demo@nfq.es npm run dev:vite -- --host 127.0.0.1 --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

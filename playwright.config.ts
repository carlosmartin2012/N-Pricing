import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.E2E_PORT ?? 3000);
if (!Number.isInteger(e2ePort) || e2ePort < 1 || e2ePort > 65535) {
  throw new Error(`Invalid E2E_PORT value: ${process.env.E2E_PORT}`);
}

const e2eBaseUrl = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;
const reuseExistingServer = process.env.E2E_REUSE_EXISTING_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: e2eBaseUrl,
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
      `VITE_DEMO_USER=demo VITE_DEMO_PASS=demo VITE_DEMO_EMAIL=demo@nfq.es npm run dev:vite -- --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer,
    timeout: 60_000,
  },
});

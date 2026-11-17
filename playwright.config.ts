import { defineConfig, devices } from '@playwright/test';

// E2E against `vite preview`, which serves the production build with the vercel.json global
// headers (plan §6.3), so the tests run under the production CSP. `npm run test:e2e` builds first.
const PORT = '4173';
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  // RNF-07: Android (Chromium) and iOS (WebKit) viewports (plan §7).
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
  },
});

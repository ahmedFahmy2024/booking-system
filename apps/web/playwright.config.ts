import { defineConfig, devices } from '@playwright/test'

// The API runs with apps/api/.env.test (an isolated Neon database, seeded by
// `npm run db:seed` with DATABASE_URL from that file). The web app uses the
// Vite dev proxy, so the browser only talks to localhost:5173.

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node --env-file=.env.test --import tsx src/index.ts',
      cwd: '../api',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: '.',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})

import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig, devices } from '@playwright/test'

const testEnvFile = new URL('../api/.env.test', import.meta.url)
if (!existsSync(testEnvFile)) {
  throw new Error('Playwright requires apps/api/.env.test with an isolated booking_system_test database.')
}

const { DATABASE_URL } = parseEnv(readFileSync(testEnvFile, 'utf8'))
const database = DATABASE_URL ? URL.parse(DATABASE_URL) : null
if (
  !DATABASE_URL ||
  !database ||
  !['postgresql:', 'postgres:'].includes(database.protocol) ||
  !database.hostname ||
  !database.hostname.includes('-pooler') ||
  database.pathname !== '/booking_system_test'
) {
  throw new Error('Set DATABASE_URL in apps/api/.env.test to a pooled isolated Postgres database named booking_system_test.')
}

const apiPort = Number(process.env.E2E_API_PORT ?? 3000)
const webPort = Number(process.env.E2E_WEB_PORT ?? 5173)
const webBaseURL = `http://localhost:${webPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: webBaseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // B4.6: the journey creates its own film/auditorium/showtime through the
      // admin API, so it needs the isolated test admin before the server starts.
      command: 'npm run seed:booking-e2e && node --import tsx src/index.ts',
      cwd: '../api',
      env: { DATABASE_URL, PORT: String(apiPort) },
      port: apiPort,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${webPort} --strictPort`,
      cwd: '.',
      env: { VITE_API_URL: '/api', E2E_API_TARGET: `http://localhost:${apiPort}` },
      port: webPort,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})

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
  database.pathname !== '/booking_system_test'
) {
  throw new Error('Set DATABASE_URL in apps/api/.env.test to an isolated Postgres database named booking_system_test.')
}

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
      command: 'node --import tsx src/index.ts',
      cwd: '../api',
      env: { DATABASE_URL, PORT: '3000' },
      port: 3000,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: '.',
      env: { VITE_API_URL: '/api' },
      port: 5173,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})

import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:5187'

export default defineConfig({
  testDir: './e2e-ui',
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    env: { VITE_API_URL: '/api' },
    url: baseURL,
    reuseExistingServer: false,
  },
})

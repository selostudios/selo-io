import { defineConfig, devices } from '@playwright/test'
import { config as loadDotenv } from 'dotenv'

// In CI the env is injected by the workflow. Locally, mirror what
// `npm run dev` does in test mode so Playwright test code (not just the
// dev server it spawns) can see NEXT_PUBLIC_SUPABASE_URL / service role
// for direct DB fixups in afterEach hooks.
if (!process.env.CI) {
  loadDotenv({ path: '.env.test.local' })
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})

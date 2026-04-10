import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsDeveloper } from './helpers'

/**
 * Visual regression tests — captures full-page screenshots and compares
 * against committed baselines to catch unintended UI changes.
 *
 * To update baselines after intentional UI changes:
 *   npm run test:e2e:update-snapshots
 */

test.describe('Visual Regression', () => {
  test.describe('Public pages', () => {
    test('login page', async ({ page }) => {
      await page.goto('/login')
      await page.waitForSelector('input[name="email"]')
      await expect(page).toHaveScreenshot('login-page.png', { fullPage: true })
    })
  })

  test.describe('Dashboard (admin)', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page)
    })

    test('dashboard overview', async ({ page }) => {
      await page.waitForSelector('[data-testid="dashboard-page"]')
      await expect(page).toHaveScreenshot('dashboard-overview.png', { fullPage: true })
    })

    test('campaigns page', async ({ page }) => {
      await page.goto('/dashboard/campaigns')
      await page.waitForURL(/\/dashboard\/campaigns/)
      await page.waitForSelector('[data-testid="campaigns-page-title"]')
      await expect(page).toHaveScreenshot('campaigns-page.png', { fullPage: true })
    })

    test('reports page', async ({ page }) => {
      await page.goto('/seo/client-reports')
      await page.waitForURL(/\/seo\/client-reports/)
      await page.waitForSelector('[data-testid="reports-page-title"]')
      await expect(page).toHaveScreenshot('reports-page.png', { fullPage: true })
    })

    test('unified audit page', async ({ page }) => {
      await page.goto('/seo/audit')
      await page.waitForURL(/\/seo\/audit/)
      await page.waitForSelector('[data-testid="unified-audit-page-title"]')
      await expect(page).toHaveScreenshot('unified-audit-page.png', { fullPage: true })
    })

    test('settings - organization tab', async ({ page }) => {
      await page.goto('/settings/organization')
      await page.waitForURL(/\/settings\/organization/)
      await page.waitForSelector('form')
      await expect(page).toHaveScreenshot('settings-organization.png', { fullPage: true })
    })

    test('settings - team tab', async ({ page }) => {
      await page.goto('/settings/team')
      await page.waitForURL(/\/settings\/team/)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot('settings-team.png', { fullPage: true })
    })
  })

  test.describe('Internal user pages', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsDeveloper(page)
    })

    test('quick audit page', async ({ page }) => {
      await page.goto('/quick-audit')
      await page.waitForURL(/\/quick-audit/)
      await page.waitForSelector('[data-testid="quick-audit-url-input"]')
      await expect(page).toHaveScreenshot('quick-audit-page.png', { fullPage: true })
    })
  })
})

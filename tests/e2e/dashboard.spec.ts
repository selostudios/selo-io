import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('loads dashboard page with integrations section', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible()
    await expect(page.getByText('Integrations')).toBeVisible()
  })

  test('period selector is interactive', async ({ page }) => {
    await page.goto('/dashboard')

    // The period selector should be visible
    const periodSelect = page.getByRole('combobox')
    await expect(periodSelect).toBeVisible()

    // Should be able to open the dropdown (use role to avoid matching trigger text)
    await periodSelect.click()
    await expect(page.getByRole('option', { name: '7 days' })).toBeVisible()
    await expect(page.getByRole('option', { name: '30 days' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'This quarter' })).toBeVisible()
  })

  test('can navigate to campaigns from sidebar', async ({ page }) => {
    await page.goto('/dashboard')

    await page.getByRole('link', { name: 'Campaigns' }).click()
    await expect(page).toHaveURL(/\/dashboard\/campaigns/)
    await expect(page.locator('[data-testid="campaigns-page-title"]')).toBeVisible()
  })

  test('can navigate to settings from sidebar', async ({ page }) => {
    await page.goto('/dashboard')

    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings\//)
  })
})

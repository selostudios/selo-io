import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsTeamMember } from './helpers'

test.describe('Campaigns', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('campaigns list page loads', async ({ page }) => {
    await page.goto('/dashboard/campaigns')

    await expect(page.locator('[data-testid="campaigns-page-title"]')).toHaveText('Campaigns')
    await expect(page.getByText('Manage your marketing campaigns')).toBeVisible()
  })

  test('admin sees new campaign button', async ({ page }) => {
    await page.goto('/dashboard/campaigns')

    await expect(page.locator('[data-testid="new-campaign-button"]').first()).toBeVisible()
  })

  test('can open create campaign dialog', async ({ page }) => {
    await page.goto('/dashboard/campaigns')

    await page.locator('[data-testid="new-campaign-button"]').first().click()

    // Dialog should open with form fields
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel('Campaign Name')).toBeVisible()
    await expect(page.getByLabel('Description')).toBeVisible()
    await expect(page.getByLabel('Start Date')).toBeVisible()
    await expect(page.getByLabel('End Date')).toBeVisible()
  })

  test('create campaign submit button is disabled with empty form', async ({ page }) => {
    await page.goto('/dashboard/campaigns')

    await page.locator('[data-testid="new-campaign-button"]').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await expect(page.locator('[data-testid="create-campaign-submit"]')).toBeDisabled()
  })

  test('can fill create campaign form and submit becomes enabled', async ({ page }) => {
    await page.goto('/dashboard/campaigns')

    await page.locator('[data-testid="new-campaign-button"]').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Submit should start disabled
    await expect(page.locator('[data-testid="create-campaign-submit"]')).toBeDisabled()

    // Fill out the form
    await page.getByLabel('Campaign Name').fill('E2E Test Campaign')
    await page.getByLabel('Description').fill('Automated test campaign')

    // Select campaign type (Radix Select: click trigger then pick option by role)
    await page.getByLabel('Campaign type').click()
    await page.getByRole('option', { name: 'Brand Awareness' }).click()

    // Set dates
    await page.getByLabel('Start Date').fill('2026-04-01')
    await page.getByLabel('End Date').fill('2026-06-30')

    // Submit should now be enabled with all fields filled
    await expect(page.locator('[data-testid="create-campaign-submit"]')).toBeEnabled()
  })
})

test.describe('Campaign Permissions', () => {
  test('team member can access campaigns and create', async ({ page }) => {
    await loginAsTeamMember(page)

    await page.goto('/dashboard/campaigns')
    await expect(page.locator('[data-testid="campaigns-page-title"]')).toBeVisible()
    await expect(page.locator('[data-testid="new-campaign-button"]').first()).toBeVisible()
  })
})

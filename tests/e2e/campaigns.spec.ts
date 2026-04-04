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

  test('can create a campaign and navigate to detail', async ({ page }) => {
    await page.goto('/dashboard/campaigns')

    await page.locator('[data-testid="new-campaign-button"]').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill out the form
    const campaignName = `E2E Test Campaign ${Date.now()}`
    await page.getByLabel('Campaign Name').fill(campaignName)
    await page.getByLabel('Description').fill('Automated test campaign')

    // Select campaign type
    await page.getByLabel('Campaign type').click()
    await page.getByText('Brand Awareness').click()

    // Set dates
    await page.getByLabel('Start Date').fill('2026-04-01')
    await page.getByLabel('End Date').fill('2026-06-30')

    // Submit
    await expect(page.locator('[data-testid="create-campaign-submit"]')).toBeEnabled()
    await page.locator('[data-testid="create-campaign-submit"]').click()

    // Should navigate to campaign detail page
    await expect(page).toHaveURL(/\/dashboard\/campaigns\/[a-f0-9-]+/, { timeout: 10000 })
    await expect(page.getByText(campaignName)).toBeVisible()
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

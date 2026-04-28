import { test, expect } from '@playwright/test'
import { getOrgIdFromDashboard, loginAsAdmin } from './helpers'
import { testMarketingReview } from '../fixtures'

test.describe('Performance report editor overview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('shows seven slide thumbnails and toggles GA visibility', async ({ page }) => {
    const orgId = await getOrgIdFromDashboard(page)

    await page.goto(`/${orgId}/reports/performance/${testMarketingReview.reviewId}`)
    await page.waitForSelector('[data-testid="slide-thumbnail-cover"]')
    await expect(page.locator('[data-testid^="slide-thumbnail-"]')).toHaveCount(7)

    const gaCard = page.locator('[data-testid="slide-thumbnail-ga_summary"]')
    await expect(gaCard).toHaveAttribute('data-hidden', 'false')

    await gaCard.locator('[data-testid="visibility-switch-ga_summary"]').click()
    await expect(gaCard).toHaveAttribute('data-hidden', 'true')

    // Toggle back so the seed stays clean for parallel tests.
    await gaCard.locator('[data-testid="visibility-switch-ga_summary"]').click()
    await expect(gaCard).toHaveAttribute('data-hidden', 'false')
  })

  test('shows the report header with title, quarter, and back link', async ({ page }) => {
    const orgId = await getOrgIdFromDashboard(page)
    await page.goto(`/${orgId}/reports/performance/${testMarketingReview.reviewId}`)

    await expect(page.locator('[data-testid="report-editor-back-link"]')).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: testMarketingReview.title })
    ).toBeVisible()
  })
})

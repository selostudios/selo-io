import { test, expect } from '@playwright/test'
import { getOrgIdFromDashboard, loginAsAdmin } from './helpers'
import { testMarketingReview } from '../fixtures'

test.describe('Performance report slide editor', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('opens the deck on the requested slide with the tray expanded', async ({ page }) => {
    const orgId = await getOrgIdFromDashboard(page)
    await page.goto(
      `/${orgId}/reports/performance/${testMarketingReview.reviewId}/slides/initiatives`
    )
    await page.waitForSelector('[data-testid="review-deck"]')
    // initiatives is index 4 in the registry (cover, ga_summary,
    // linkedin_insights, content_highlights, initiatives, takeaways, planning).
    await expect(page.locator('[data-testid="review-deck-track"]')).toHaveAttribute(
      'data-current-index',
      '4'
    )
    await expect(page.locator('[data-testid="tray-body"]')).toBeVisible()
  })

  test('returns 404 for an unknown slide key', async ({ page }) => {
    const orgId = await getOrgIdFromDashboard(page)
    const response = await page.goto(
      `/${orgId}/reports/performance/${testMarketingReview.reviewId}/slides/not_a_slide`
    )
    expect(response?.status()).toBe(404)
  })

  test('toggling visibility on a hidden-able slide shows the dim overlay and Hidden badge', async ({
    page,
  }) => {
    const orgId = await getOrgIdFromDashboard(page)
    await page.goto(
      `/${orgId}/reports/performance/${testMarketingReview.reviewId}/slides/ga_summary`
    )
    await page.waitForSelector('[data-testid="review-deck"]')

    // The header toggle for the current slide.
    const toggle = page.locator('[data-testid="visibility-switch-ga_summary"]').first()

    // Hide the slide. Server action revalidates the page and the deck re-renders
    // with the slide wrapped in <HiddenSlideOverlay>.
    await toggle.click()
    await expect(page.locator('[data-testid="hidden-slide-overlay"]').first()).toBeVisible()
    await expect(page.getByText('Hidden').first()).toBeVisible()

    // Toggle back so the seed stays clean for parallel tests.
    await toggle.click()
    await expect(page.locator('[data-testid="hidden-slide-overlay"]').first()).not.toBeVisible()
  })
})

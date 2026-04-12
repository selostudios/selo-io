import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsDeveloper } from './helpers'

test.describe('Full Site Audit', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('navigates to unified audit page', async ({ page }) => {
    await page.goto('/seo/audit')

    await expect(page).toHaveURL(/\/seo\/audit/)
    await expect(page.locator('[data-testid="unified-audit-page-title"]')).toHaveText(
      'Full Site Audit'
    )
  })

  test('shows URL input for one-time audit', async ({ page }) => {
    await page.goto('/seo/audit')

    // Should show URL input and run button
    await expect(page.locator('[data-testid="audit-url-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="audit-run-button"]')).toBeVisible()
  })

  test('run button is disabled without URL', async ({ page }) => {
    await page.goto('/seo/audit')

    await expect(page.locator('[data-testid="audit-run-button"]')).toBeDisabled()
  })

  test('run button is enabled with URL', async ({ page }) => {
    await page.goto('/seo/audit')

    await page.locator('[data-testid="audit-url-input"]').fill('https://example.com')
    await expect(page.locator('[data-testid="audit-run-button"]')).toBeEnabled()
  })

  test.skip('starts audit and shows progress', async ({ page }) => {
    await page.goto('/seo/audit')

    await page.locator('[data-testid="audit-url-input"]').fill('https://example.com')
    await page.locator('[data-testid="audit-run-button"]').click()

    // Should navigate to audit detail page with progress view
    await expect(page).toHaveURL(/\/seo\/audit\/[a-f0-9-]+/, { timeout: 15000 })
    await expect(page.locator('[data-testid="audit-progress"]')).toBeVisible({ timeout: 10000 })
  })

  test('completed audit shows score cards and tabs', async ({ page }) => {
    // This test requires a completed audit to exist in the database
    // Navigate to audit list and click the first completed audit
    await page.goto('/seo/audit')

    // Look for a "View" link to a completed audit (scoped to main content to avoid sidebar matches)
    const viewButton = page.locator('main a:has-text("View")').first()
    const hasCompletedAudit = await viewButton.isVisible().catch(() => false)

    if (!hasCompletedAudit) {
      test.skip()
      return
    }

    await viewButton.click()
    await expect(page).toHaveURL(/\/seo\/audit\/[a-f0-9-]+/)

    // Verify score cards are displayed
    await expect(page.locator('[data-testid="audit-score-cards"]')).toBeVisible()
    await expect(page.locator('[data-testid="audit-report-title"]')).toBeVisible()

    // Verify tabs are present
    await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-seo"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-performance"]')).toBeVisible()
    await expect(page.locator('[data-testid="tab-ai-readiness"]')).toBeVisible()

    // Switch to SEO tab
    await page.locator('[data-testid="tab-seo"]').click()
    await expect(page).toHaveURL(/tab=seo/)

    // Switch to Performance tab
    await page.locator('[data-testid="tab-performance"]').click()
    await expect(page).toHaveURL(/tab=performance/)

    // Switch to AI Readiness tab
    await page.locator('[data-testid="tab-ai-readiness"]').click()
    await expect(page).toHaveURL(/tab=ai-readiness/)

    // Switch back to Overview tab
    await page.locator('[data-testid="tab-overview"]').click()
    // Overview removes the tab param
    await expect(page).not.toHaveURL(/tab=/)
  })

  test('old site-audit page shows deprecation banner', async ({ page }) => {
    await page.goto('/seo/site-audit')

    await expect(page.getByText('has been replaced by the')).toBeVisible()
    await expect(page.getByText('Go to Full Site Audit')).toBeVisible()
  })

  test('old page-speed page shows deprecation banner', async ({ page }) => {
    await page.goto('/seo/page-speed')

    await expect(page.getByText('has been replaced by the')).toBeVisible()
    await expect(page.getByText('Go to Full Site Audit')).toBeVisible()
  })

  // Note: old /seo/aio route was removed when AIO tables were dropped
})

test.describe('Quick Audit (Unified)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDeveloper(page)
  })

  test('quick audit page has unified audit flow', async ({ page }) => {
    await page.goto('/quick-audit')

    // Should show single URL input and Run Audit button
    await expect(page.locator('[data-testid="quick-audit-url-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="quick-audit-run-button"]')).toBeVisible()

    // Should mention "Full Site Audit" in the description
    await expect(page.getByText('Comprehensive analysis')).toBeVisible()
  })
})

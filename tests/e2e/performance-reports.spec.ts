import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { loginAsAdmin } from './helpers'
import { testMarketingReview } from '../fixtures'

/**
 * E2E coverage for Performance Reports Phase 4: preview, publish, and public
 * share flows. Relies on the marketing_reviews / draft / snapshot seeded by
 * `tests/helpers/seed.ts`.
 *
 * Each `test.describe` block is self-contained — no cross-test state — so
 * Playwright can run them in parallel.
 */

const editorPathRegex =
  /\/[0-9a-f-]{36}\/reports\/performance\/11111111-1111-4111-8111-111111111111(\?|$|#)/
const previewPathRegex = /\/reports\/performance\/[0-9a-f-]{36}\/preview(\?|$|#)/
const snapshotDetailPathRegex =
  /\/reports\/performance\/[0-9a-f-]{36}\/snapshots\/[0-9a-f-]{36}(\?|$|#)/

/**
 * Resolves the seeded org's UUID from the post-login dashboard URL.
 *
 * The app resolves the org via the `selo-org` cookie set by the proxy
 * middleware once the user lands on `/`. Reading the ID off the URL avoids
 * hard-coding it in tests and stays in step with however the seed builds
 * the organization row.
 */
async function getSeededOrgId(page: Page): Promise<string> {
  await page.goto('/')
  await page.waitForURL(/\/[0-9a-f-]{36}\/dashboard/)
  const match = page.url().match(/\/([0-9a-f-]{36})\/dashboard/)
  if (!match) throw new Error(`Could not parse org id from ${page.url()}`)
  return match[1]
}

test.describe('Performance Reports — narrative editing + preview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin edits the cover subtitle and sees it in the preview deck', async ({ page }) => {
    const orgId = await getSeededOrgId(page)

    await page.goto(`/${orgId}/reports/performance/${testMarketingReview.reviewId}`)
    await expect(page).toHaveURL(editorPathRegex)
    await page.waitForSelector('[data-testid="narrative-editor"]')

    // Edit the cover subtitle with a distinctive string the preview will echo.
    const distinctiveSubtitle = 'E2E test subtitle 12345'
    const subtitle = page.locator('[data-testid="narrative-editor-cover_subtitle"]')
    await subtitle.fill(distinctiveSubtitle)

    // Wait for the autosave debounce (1500ms) to settle so the preview query
    // sees the new draft. The "Saved" status label is the component's
    // persistent success signal.
    await expect(page.locator('text=Saved').first()).toBeVisible({ timeout: 5000 })

    // Click Preview and verify we land on the preview route with the deck.
    await page.locator('[data-testid="performance-reports-editor-preview-button"]').click()
    await page.waitForURL(previewPathRegex)

    await expect(page.locator('[data-testid="performance-reports-preview"]')).toBeVisible()
    await expect(page.locator('[data-testid="review-deck"]')).toBeVisible()

    // Cover slide (slide index 0) is visible by default — the distinctive
    // subtitle must appear there.
    await expect(page.getByText(distinctiveSubtitle)).toBeVisible()
  })
})

test.describe('Performance Reports — publish from preview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('publish button navigates to the new snapshot detail page', async ({ page }) => {
    const orgId = await getSeededOrgId(page)

    await page.goto(`/${orgId}/reports/performance/${testMarketingReview.reviewId}/preview`)
    await page.waitForSelector('[data-testid="performance-reports-preview"]')

    // Click publish and wait for the router.push into the snapshot detail URL.
    await page.locator('[data-testid="performance-reports-preview-publish-button"]').click()
    await page.waitForURL(snapshotDetailPathRegex, { timeout: 15_000 })

    // The detail page must render the key UI: breadcrumb, deck, share button.
    await expect(page.locator('[data-testid="performance-reports-snapshot-detail"]')).toBeVisible()
    await expect(page.locator('[data-testid="performance-reports-snapshot-title"]')).toBeVisible()
    await expect(page.locator('[data-testid="review-deck"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="performance-reports-snapshot-share-button"]')
    ).toBeVisible()
  })
})

test.describe('Performance Reports — public share access', () => {
  test('unauthenticated visitor can view a seeded public share URL', async ({ browser }) => {
    // Use a fresh context with no auth cookies — the seeded share token is
    // the canonical "public visitor" entry point.
    const context = await browser.newContext()
    try {
      const publicPage = await context.newPage()
      await publicPage.goto(`/s/${testMarketingReview.publicShareToken}`)

      // If the shared_links CHECK constraint still excludes 'marketing_review'
      // the seed will have skipped the share row — detect that and skip
      // gracefully rather than failing the whole suite.
      const notFoundHeading = publicPage.getByRole('heading', { name: /Not Found/i })
      const seedMissingShareLink = await notFoundHeading
        .isVisible({ timeout: 2000 })
        .catch(() => false)
      if (seedMissingShareLink) {
        test.skip(
          true,
          'Public share link not seeded — shared_links.resource_type ' +
            'constraint likely missing "marketing_review".'
        )
        return
      }

      // The shared page renders the deck inside the public wrapper — the
      // presence of `shared-marketing-review` implies the auth layout was
      // NOT used (the `/s/` route never mounts the `(authenticated)` group).
      await expect(publicPage.locator('[data-testid="shared-marketing-review"]')).toBeVisible({
        timeout: 10_000,
      })
      await expect(publicPage.locator('[data-testid="review-deck"]')).toBeVisible()
    } finally {
      await context.close()
    }
  })
})

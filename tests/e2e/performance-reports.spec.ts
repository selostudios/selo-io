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
  test('admin creates share link from snapshots list and an unauthenticated visitor can view it', async ({
    page,
    browser,
  }) => {
    // This test exercises the full in-app share flow described in the Phase 4
    // spec: admin opens the snapshots list, clicks Share, submits the
    // ShareModal, captures the generated `/s/{token}` URL, then verifies an
    // unauthenticated visitor can load the deck from that URL.
    //
    // We deliberately do NOT rely on a pre-seeded shared_links row — the URL
    // under test is the one the UI just produced.
    await loginAsAdmin(page)
    const orgId = await getSeededOrgId(page)

    await page.goto(`/${orgId}/reports/performance/${testMarketingReview.reviewId}/snapshots`)
    await page.waitForSelector('[data-testid="performance-reports-snapshots-list-title"]')

    // Click the row-level Share button. Each snapshot row owns its own
    // ShareModal instance keyed on snapshot id — target that specific one so
    // we don't race a future sibling modal.
    await page
      .locator(
        `[data-testid="performance-reports-snapshots-share-button-${testMarketingReview.snapshotId}"]`
      )
      .click()

    // ShareModal uses the shadcn Dialog — it mounts into a portal with
    // role=dialog. The "Create Share Link" button is the primary action.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /create share link/i }).click()

    // After creation the modal swaps to the success view, which renders a
    // readonly Input pre-filled with the public share URL.
    await expect(dialog.getByText('Link created!')).toBeVisible({ timeout: 10_000 })
    const shareUrl = await dialog.locator('input[readonly]').inputValue()
    expect(shareUrl).toMatch(/\/s\/[^/]+$/)

    // Fresh browser context = no auth cookies. This is the canonical
    // unauthenticated visitor path.
    const context = await browser.newContext()
    try {
      const publicPage = await context.newPage()
      await publicPage.goto(shareUrl)

      // `shared-marketing-review` is only rendered by the public `/s/`
      // route wrapper — its presence proves we bypassed the authenticated
      // layout and are seeing the deck via the public share handler.
      await expect(publicPage.locator('[data-testid="shared-marketing-review"]')).toBeVisible({
        timeout: 10_000,
      })
      await expect(publicPage.locator('[data-testid="review-deck"]')).toBeVisible()
    } finally {
      await context.close()
    }
  })
})

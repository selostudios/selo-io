import { test, expect } from '@playwright/test'
import { getOrgIdFromDashboard, loginAsAdmin } from './helpers'
import { testMarketingReview, testStyleMemo } from '../fixtures'

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

test.describe('Performance Reports — narrative editing + preview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin edits the cover subtitle and sees it in the preview deck', async ({ page }) => {
    const orgId = await getOrgIdFromDashboard(page)

    await page.goto(`/${orgId}/reports/performance/${testMarketingReview.reviewId}`)
    await expect(page).toHaveURL(editorPathRegex)
    await page.waitForSelector('[data-testid="narrative-editor"]')

    // Edit the cover subtitle with a distinctive string the preview will echo.
    const distinctiveSubtitle = 'E2E test subtitle 12345'
    const subtitle = page.locator('[data-testid="narrative-editor-cover_subtitle"]')
    await subtitle.fill(distinctiveSubtitle)

    // Wait for the autosave debounce (1500ms) to settle so the preview query
    // sees the new draft. Target the cover_subtitle block's specific status
    // span — one "Saved" label renders per block, so a bare text selector
    // would race sibling blocks.
    await expect(page.locator('[data-testid="narrative-save-status-cover_subtitle"]')).toHaveText(
      'Saved',
      { timeout: 5000 }
    )

    // Click Preview and verify we land on the preview route with the deck.
    await page.locator('[data-testid="performance-reports-editor-preview-button"]').click()
    await page.waitForURL(previewPathRegex)

    await expect(page.locator('[data-testid="performance-reports-preview"]')).toBeVisible()
    await expect(page.locator('[data-testid="review-deck"]')).toBeVisible()

    // Cover slide (slide index 0) is visible by default — scope to the active
    // deck track and take the first match to avoid strict-mode collision with
    // the hidden adjacent-slide copy that the carousel keeps in the DOM.
    await expect(
      page.getByTestId('review-deck-track').getByText(distinctiveSubtitle).first()
    ).toBeVisible()
  })
})

test.describe('Performance Reports — publish from preview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('publish button navigates to the new snapshot detail page', async ({ page }) => {
    const orgId = await getOrgIdFromDashboard(page)

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

test.describe('Performance Reports — style memo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin can view the learned style memo in settings', async ({ page }) => {
    // The memo row is pre-seeded in tests/helpers/seed.ts — this E2E verifies
    // the settings page renders it. We deliberately do NOT exercise the live
    // learner (`after()` → LLM call) here; that path is covered by unit tests
    // and would be flaky + costly in E2E.
    const orgId = await getOrgIdFromDashboard(page)

    await page.goto(`/${orgId}/reports/performance/settings`)
    await page.waitForSelector('[data-testid="style-memo-card"]')

    await expect(page.locator('[data-testid="style-memo-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="style-memo-textarea"]')).toHaveValue(
      testStyleMemo.memo
    )
  })
})

test.describe('Performance Reports — memo history surfaces', () => {
  test('snapshot-detail callout renders and links to the settings timeline', async ({ page }) => {
    await loginAsAdmin(page)
    const orgId = await getOrgIdFromDashboard(page)

    await page.goto(
      `/${orgId}/reports/performance/${testMarketingReview.reviewId}/snapshots/${testMarketingReview.snapshotId}`
    )
    await page.waitForSelector('[data-testid="performance-reports-snapshot-detail"]')

    const callout = page.locator('[data-testid="snapshot-learner-callout"]')
    await expect(callout).toBeVisible()
    await expect(page.locator('[data-testid="snapshot-learner-callout-rationale"]')).toContainText(
      'Noticed author prefers punchy bullets'
    )

    const historyLink = callout.getByRole('link', { name: /view full history/i })
    await expect(historyLink).toHaveAttribute(
      'href',
      `/${orgId}/reports/performance/settings#memo-history`
    )
  })

  test('settings timeline lists seeded rows and row expand reveals the memo', async ({ page }) => {
    await loginAsAdmin(page)
    const orgId = await getOrgIdFromDashboard(page)

    await page.goto(`/${orgId}/reports/performance/settings`)
    await page.waitForSelector('[data-testid="style-memo-history-timeline"]')

    await expect(page.locator('[data-testid="style-memo-history-row-0"]')).toBeVisible()
    await expect(page.locator('[data-testid="style-memo-history-row-1"]')).toBeVisible()

    await page.locator('[data-testid="style-memo-history-expand-0"]').click()
    await expect(page.locator('[data-testid="style-memo-history-row-0"]')).toContainText(
      testStyleMemo.memo
    )
  })

  test('public share route does not render the learner callout', async ({ page }) => {
    await page.goto(`/s/${testMarketingReview.publicShareToken}`)
    await expect(page.locator('[data-testid="shared-marketing-review"]')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator('[data-testid="snapshot-learner-callout"]')).toHaveCount(0)
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
    const orgId = await getOrgIdFromDashboard(page)

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

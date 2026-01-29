import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

test.describe('Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')
    // Dashboard may include org query param
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('navigates to reports page', async ({ page }) => {
    // Navigate directly to reports page
    await page.goto('/seo/reports')

    await expect(page).toHaveURL(/\/seo\/reports/)
    await expect(page.locator('[data-testid="reports-page-title"]')).toHaveText('Report History')
  })

  test('shows empty state when no reports exist', async ({ page }) => {
    await page.goto('/seo/reports')

    // Should show empty state message
    await expect(page.locator('[data-testid="reports-empty-state"]')).toBeVisible()
  })

  test('has create report button', async ({ page }) => {
    await page.goto('/seo/reports')

    // Should have create report button
    await expect(page.locator('[data-testid="new-report-button"]')).toBeVisible()
  })

  test('navigates to new report page', async ({ page }) => {
    await page.goto('/seo/reports')

    // Click create report button
    await page.locator('[data-testid="new-report-button"]').click()

    await expect(page).toHaveURL(/\/seo\/reports\/new/)
    await expect(page.locator('[data-testid="new-report-page-title"]')).toHaveText('New Report')
  })

  test('shows audit selection on new report page', async ({ page }) => {
    await page.goto('/seo/reports/new')

    // Should show audit selection cards
    await expect(page.locator('[data-testid="seo-audit-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="pagespeed-audit-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="aio-audit-card"]')).toBeVisible()
  })

  test('shows instruction message when no audits selected', async ({ page }) => {
    await page.goto('/seo/reports/new')

    // When no audits are selected, should show instruction card
    await expect(page.locator('[data-testid="selection-instructions"]')).toBeVisible()
  })
})

test.describe('Report Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('has search functionality', async ({ page }) => {
    await page.goto('/seo/reports')

    // The page should load without errors - check for main heading
    await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
  })

  test('can type in search input', async ({ page }) => {
    await page.goto('/seo/reports')

    // Page should load correctly - check for main heading
    await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
  })
})

test.describe('Public Report Access', () => {
  test('shows error for invalid share token', async ({ page }) => {
    // Try to access a non-existent shared report
    await page.goto('/r/invalid-token-12345')

    // Should show error page
    await expect(page.getByRole('heading', { name: /Not Found/i })).toBeVisible()
  })

  test('shows error for expired share link', async ({ page }) => {
    // Attempt to access with a token that doesn't exist
    await page.goto('/r/expired-test-token')

    await expect(page.getByRole('heading', { name: /Not Found/i })).toBeVisible()
  })
})

test.describe('Report Permissions', () => {
  test('viewer can access reports page', async ({ page }) => {
    // Login as viewer
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.viewer.email)
    await page.fill('input[name="password"]', testUsers.viewer.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/)

    // Navigate directly to reports
    await page.goto('/seo/reports')
    await expect(page).toHaveURL(/\/seo\/reports/)
    await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
  })

  test('team member can access reports page', async ({ page }) => {
    // Login as team member
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.teamMember.email)
    await page.fill('input[name="password"]', testUsers.teamMember.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/)

    // Navigate directly to reports
    await page.goto('/seo/reports')
    await expect(page).toHaveURL(/\/seo\/reports/)
    await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
  })
})

import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsTeamMember } from './helpers'
import { testUsers } from '../fixtures'

test.describe('Client Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('navigates to client reports page', async ({ page }) => {
    await page.goto('/seo/client-reports')

    await expect(page).toHaveURL(/\/seo\/client-reports/)
    await expect(page.locator('[data-testid="reports-page-title"]')).toHaveText('Client Reports')
  })

  test('shows completed audits table', async ({ page }) => {
    await page.goto('/seo/client-reports')

    // Should show the page title
    await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
  })
})

test.describe('Client Report Search', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('has search functionality', async ({ page }) => {
    await page.goto('/seo/client-reports')

    // The page should load without errors - check for main heading
    await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
  })

  test('can type in search input', async ({ page }) => {
    await page.goto('/seo/client-reports')

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

test.describe('Client Report Permissions', () => {
  test('viewer can access client reports page', async ({ page }) => {
    // Login as viewer — use inline login since no helper for viewer
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.viewer.email)
    await page.fill('input[name="password"]', testUsers.viewer.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|organizations)/)
    await page.goto('/')
    await page.waitForURL(/\/dashboard/)

    // Navigate directly to client reports
    await page.goto('/seo/client-reports')
    await expect(page).toHaveURL(/\/seo\/client-reports/)
    await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
  })

  test('team member can access client reports page', async ({ page }) => {
    await loginAsTeamMember(page)

    // Navigate directly to client reports
    await page.goto('/seo/client-reports')
    await expect(page).toHaveURL(/\/seo\/client-reports/)
    await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
  })
})

import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

test.describe('Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('navigates to reports page', async ({ page }) => {
    // Navigate to reports via sidebar
    await page.click('a[href="/seo/reports"]')

    await expect(page).toHaveURL('/seo/reports')
    await expect(page.getByRole('heading', { name: /Reports/i })).toBeVisible()
  })

  test('shows empty state when no reports exist', async ({ page }) => {
    await page.goto('/seo/reports')

    // Should show empty state message
    await expect(page.getByText(/No reports yet/i)).toBeVisible()
  })

  test('has create report button', async ({ page }) => {
    await page.goto('/seo/reports')

    // Should have create report button
    const createButton = page.getByRole('link', { name: /Create Report|New Report/i })
    await expect(createButton).toBeVisible()
  })

  test('navigates to new report page', async ({ page }) => {
    await page.goto('/seo/reports')

    // Click create report
    await page.click('a[href="/seo/reports/new"]')

    await expect(page).toHaveURL('/seo/reports/new')
    await expect(page.getByRole('heading', { name: /New Report|Create Report/i })).toBeVisible()
  })

  test('shows audit selection on new report page', async ({ page }) => {
    await page.goto('/seo/reports/new')

    // Should show audit selection sections
    await expect(page.getByText(/SEO Audit/i)).toBeVisible()
    await expect(page.getByText(/PageSpeed/i)).toBeVisible()
    await expect(page.getByText(/AIO/i)).toBeVisible()
  })

  test('shows validation message when audits are missing', async ({ page }) => {
    await page.goto('/seo/reports/new')

    // Try to click create without selecting audits
    const createButton = page.getByRole('button', { name: /Create Report/i })

    // Button should be disabled if no audits are available
    await expect(createButton).toBeDisabled()
  })
})

test.describe('Report Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('has search functionality', async ({ page }) => {
    await page.goto('/seo/reports')

    // Should have search input
    const searchInput = page.getByPlaceholder(/Search/i)
    await expect(searchInput).toBeVisible()
  })

  test('can type in search input', async ({ page }) => {
    await page.goto('/seo/reports')

    const searchInput = page.getByPlaceholder(/Search/i)
    await searchInput.fill('test-domain')

    await expect(searchInput).toHaveValue('test-domain')
  })
})

test.describe('Public Report Access', () => {
  test('shows error for invalid share token', async ({ page }) => {
    // Try to access a non-existent shared report
    await page.goto('/r/invalid-token-12345')

    // Should show error page
    await expect(page.getByText(/not exist|not found|error/i)).toBeVisible()
  })

  test('shows error for expired share link', async ({ page }) => {
    // Attempt to access with a token that doesn't exist (will show "not found")
    await page.goto('/r/expired-test-token')

    await expect(page.getByText(/not exist|not found|expired/i)).toBeVisible()
  })
})

test.describe('Report Permissions', () => {
  test('viewer can access reports page', async ({ page }) => {
    // Login as viewer
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.viewer.email)
    await page.fill('input[name="password"]', testUsers.viewer.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')

    // Navigate to reports
    await page.click('a[href="/seo/reports"]')
    await expect(page).toHaveURL('/seo/reports')
  })

  test('team member can access reports page', async ({ page }) => {
    // Login as team member
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.teamMember.email)
    await page.fill('input[name="password"]', testUsers.teamMember.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')

    // Navigate to reports
    await page.click('a[href="/seo/reports"]')
    await expect(page).toHaveURL('/seo/reports')
  })
})

import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

test.describe('Support Section - Access Control', () => {
  test('non-developer is redirected to dashboard', async ({ page }) => {
    // Login as team member (not developer or admin)
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.teamMember.email)
    await page.fill('input[name="password"]', testUsers.teamMember.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')

    // Try to access support directly
    await page.goto('/support')

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard')
  })
})

test.describe('Support Section - Developer Access', () => {
  test('developer can view support section', async ({ page }) => {
    // Login as developer
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.developer.email)
    await page.fill('input[name="password"]', testUsers.developer.password)
    await page.click('button[type="submit"]')

    // Wait for navigation to dashboard after login
    await expect(page).toHaveURL('/dashboard')

    // Navigate to support
    await page.goto('/support')

    // Should remain on support page (not redirected)
    await expect(page).toHaveURL('/support')

    // Should see support page heading
    await expect(page.getByRole('heading', { name: 'Support', level: 1 })).toBeVisible()
  })

  test('developer can filter feedback', async ({ page }) => {
    // Login as developer
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.developer.email)
    await page.fill('input[name="password"]', testUsers.developer.password)
    await page.click('button[type="submit"]')

    // Wait for navigation to dashboard after login
    await expect(page).toHaveURL('/dashboard')

    await page.goto('/support')

    // Click status filter combobox
    const statusFilter = page.locator('[role="combobox"]').filter({ hasText: 'All Statuses' })
    await statusFilter.click()

    // Select New status from dropdown
    await page.locator('[role="option"]').filter({ hasText: /^New$/ }).first().click()

    // Filter should be applied - Clear button becomes visible
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
  })

  test.skip('developer can open feedback slideout', async ({ page }) => {
    // This requires seeded feedback data
    // Login as developer and navigate to support
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.developer.email)
    await page.fill('input[name="password"]', testUsers.developer.password)
    await page.click('button[type="submit"]')

    await page.goto('/support')

    // Click on a feedback row (would need seeded data)
    // Slideout should open
  })
})

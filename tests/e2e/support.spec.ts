import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

test.describe('Support Section - Access Control', () => {
  test('non-developer is redirected to dashboard', async ({ page }) => {
    // Login as admin (not developer)
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')

    // Try to access support directly
    await page.goto('/support')

    // Should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard')
  })
})

// These tests require a developer user to be seeded, which may not exist yet
// They demonstrate the expected behavior
test.describe('Support Section - Developer Access', () => {
  test.skip('developer can view support section', async ({ page }) => {
    // This test is skipped until developer seed data is configured
    // Login as developer
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.developer.email)
    await page.fill('input[name="password"]', testUsers.developer.password)
    await page.click('button[type="submit"]')

    // Navigate to support
    await page.goto('/support')

    // Should see support page
    await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible()
  })

  test.skip('developer can filter feedback', async ({ page }) => {
    // Login as developer
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.developer.email)
    await page.fill('input[name="password"]', testUsers.developer.password)
    await page.click('button[type="submit"]')

    await page.goto('/support')

    // Click status filter
    await page.click('text=All Statuses')
    await page.click('text=New')

    // Filter should be applied
    await expect(page.getByText('Clear')).toBeVisible()
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

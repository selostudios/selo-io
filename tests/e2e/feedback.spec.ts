import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

test.describe('Feedback Submission', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('opens feedback dialog from user menu', async ({ page }) => {
    // Click user menu (look for the user avatar/button)
    await page.click('[data-testid="user-menu-trigger"]')

    // Click "Report an Issue"
    await page.click('text=Report an Issue')

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Report an Issue' })).toBeVisible()
  })

  test('opens feedback dialog with CMD+Shift+F', async ({ page }) => {
    // Press keyboard shortcut (Mac)
    await page.keyboard.press('Meta+Shift+f')

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('submits feedback successfully', async ({ page }) => {
    // Open dialog via user menu
    await page.click('[data-testid="user-menu-trigger"]')
    await page.click('text=Report an Issue')

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill form
    await page.fill('input[name="title"]', 'Test Bug Report')
    await page.fill(
      'textarea[name="description"]',
      'This is a detailed description of the bug I found for E2E testing purposes.'
    )

    // Category should default to 'bug', but let's change it
    await page.click('[data-testid="category-select"]')
    await page.click('text=Feature Request')

    // Submit
    await page.click('button[type="submit"]:has-text("Submit")')

    // Should show success toast and close dialog
    await expect(page.getByText('Feedback submitted')).toBeVisible()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  })

  test('validates required fields', async ({ page }) => {
    // Open dialog
    await page.keyboard.press('Meta+Shift+f')
    await expect(page.getByRole('dialog')).toBeVisible()

    // Submit button should be present
    const submitButton = page.locator('button[type="submit"]:has-text("Submit")')

    // Try to submit with empty title (click submit)
    await submitButton.click()

    // Should not close (form validation should prevent submission)
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

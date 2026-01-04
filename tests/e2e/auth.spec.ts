import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

test.describe('Authentication', () => {
  test('user can login and reach dashboard', async ({ page }) => {
    await page.goto('/')

    // Should redirect to login
    await expect(page).toHaveURL('/login')

    // Login
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Test Organization')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'wrong@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error
    await expect(page.locator('text=/invalid.*credentials/i')).toBeVisible()
  })

  test('login button is disabled for invalid email', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'invalid-email')
    await page.fill('input[name="password"]', 'password123')

    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeDisabled()
  })
})

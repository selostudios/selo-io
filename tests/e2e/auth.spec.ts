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

    // Should redirect to dashboard (may include org query param)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'wrong@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error
    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })

  test('login button is disabled for invalid email', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'invalid-email')
    await page.fill('input[name="password"]', 'password123')

    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeDisabled()
  })
})

test.describe('Access Denied Page', () => {
  test('displays access denied message with Selo logo', async ({ page }) => {
    await page.goto('/access-denied')

    // Should show access denied heading
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible()

    // Should show invitation-only message
    await expect(page.getByText(/Access to this application is by invitation only/)).toBeVisible()

    // Should show Selo logo
    await expect(page.getByAltText('Selo')).toBeVisible()

    // Should have link back to login
    await expect(page.getByRole('link', { name: 'Back to Login' })).toBeVisible()
  })

  test('back to login link works', async ({ page }) => {
    await page.goto('/access-denied')

    await page.click('text=Back to Login')

    await expect(page).toHaveURL('/login')
  })
})

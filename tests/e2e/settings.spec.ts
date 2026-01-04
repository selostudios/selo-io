import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin can update organization name', async ({ page }) => {
    await page.goto('/settings/organization')

    // Update organization name
    const nameInput = page.locator('input[name="name"]')
    await nameInput.fill('Updated Org Name')

    // Save changes
    await page.click('button:has-text("Save Changes")')

    // Should show success message
    await expect(page.locator('text=/successfully/i')).toBeVisible()
  })

  test('admin can navigate between settings tabs', async ({ page }) => {
    await page.goto('/settings/organization')

    // Click Team tab
    await page.click('text=Team')
    await expect(page).toHaveURL('/settings/team')

    // Click Integrations tab
    await page.click('text=Integrations')
    await expect(page).toHaveURL('/settings/integrations')

    // Click Organization tab
    await page.click('text=Organization')
    await expect(page).toHaveURL('/settings/organization')
  })

  test('admin can view team members', async ({ page }) => {
    await page.goto('/settings/team')

    // Should see admin user
    await expect(page.locator('text=Admin User')).toBeVisible()
    await expect(page.locator('text=admin@test.com')).toBeVisible()

    // Should see team member
    await expect(page.locator('text=Team Member')).toBeVisible()
    await expect(page.locator('text=member@test.com')).toBeVisible()
  })
})

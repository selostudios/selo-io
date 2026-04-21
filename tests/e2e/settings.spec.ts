import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin can update organization name', async ({ page }) => {
    await page.goto('/settings/organization')

    // Wait for hydration
    await page.waitForLoadState('networkidle')

    const nameInput = page.locator('input[name="name"]')
    const saveButton = page.locator('button:has-text("Save Changes")')

    // Rename away from the canonical seed value
    await nameInput.clear()
    await nameInput.type('Updated Org Name')
    await expect(saveButton).toBeEnabled({ timeout: 5000 })
    await saveButton.click()
    await expect(page.locator('text=/successfully/i')).toBeVisible()

    // Restore canonical name — downstream visual tests read org name live from DB and snapshot it.
    await nameInput.clear()
    await nameInput.type('Test Organization')
    await expect(saveButton).toBeEnabled({ timeout: 5000 })
    await saveButton.click()
    await expect(page.locator('text=/successfully/i')).toBeVisible()
  })

  test('admin can navigate between settings tabs', async ({ page }) => {
    await page.goto('/settings/organization')

    // Click Team tab
    await page.getByRole('link', { name: 'Team' }).click()
    await expect(page).toHaveURL(/\/settings\/team/)

    // Click Integrations tab
    await page.getByRole('link', { name: 'Integrations' }).click()
    await expect(page).toHaveURL(/\/settings\/integrations/)

    // Click Organization tab
    await page.getByRole('link', { name: 'Organization' }).click()
    await expect(page).toHaveURL(/\/settings\/organization/)
  })

  test('admin can view team members', async ({ page }) => {
    await page.goto('/settings/team')

    // Should see admin user (use email which is unique)
    await expect(page.getByText('admin@test.com')).toBeVisible()

    // Should see team member (use email which is unique)
    await expect(page.getByText('member@test.com')).toBeVisible()
  })
})

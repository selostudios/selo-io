import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loginAsAdmin } from './helpers'
import { testOrganization } from '../fixtures'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin can update organization name', async ({ page }) => {
    // Restore the canonical name via the service client regardless of test
    // outcome — the UI-based restore used to race the success toast (the
    // first "saved successfully" toast stayed visible and satisfied the
    // second assertion before the second save had actually committed),
    // leaving the org in the renamed state and breaking downstream visual
    // tests that snapshot the org name.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await page.goto('/settings/organization')
    await page.waitForLoadState('networkidle')

    const nameInput = page.locator('input[name="name"]')
    const saveButton = page.locator('button:has-text("Save Changes")')

    try {
      await nameInput.clear()
      await nameInput.type('Updated Org Name')
      await expect(saveButton).toBeEnabled({ timeout: 5000 })
      await saveButton.click()
      await expect(page.locator('text=/successfully/i')).toBeVisible()
    } finally {
      await supabase
        .from('organizations')
        .update({ name: testOrganization.name })
        .eq('name', 'Updated Org Name')
    }
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

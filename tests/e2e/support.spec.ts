import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsDeveloper, loginAsTeamMember } from './helpers'

test.describe('Support Section - Access Control', () => {
  test('team member without feedback permission is redirected', async ({ page }) => {
    await loginAsTeamMember(page)

    await page.goto('/support')

    // Should be redirected to dashboard (team_member lacks feedback:view)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('admin can access support', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/support')

    // Admin has feedback:view — should stay on support
    await expect(page).toHaveURL(/\/support/)
    await expect(page.getByRole('heading', { name: 'Support', level: 1 })).toBeVisible()
  })
})

test.describe('Support Section - Standalone Route', () => {
  test('support page loads at /support without org prefix', async ({ page }) => {
    await loginAsDeveloper(page)

    await page.goto('/support')

    // Should remain at /support (no org UUID in URL)
    await expect(page).toHaveURL('/support')
    await expect(page.getByRole('heading', { name: 'Support', level: 1 })).toBeVisible()
  })

  test('support URL does not contain org UUID', async ({ page }) => {
    await loginAsDeveloper(page)

    await page.goto('/support')

    // Verify URL has no UUID prefix
    const url = page.url()
    const pathname = new URL(url).pathname
    expect(pathname).toBe('/support')
    expect(pathname).not.toMatch(/^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
  })

  test('developer can filter feedback', async ({ page }) => {
    await loginAsDeveloper(page)

    await page.goto('/support')

    // Click status filter combobox
    const statusFilter = page.locator('[role="combobox"]').filter({ hasText: 'All Statuses' })
    await statusFilter.click()

    // Select New status from dropdown
    await page.locator('[role="option"]').filter({ hasText: /^New$/ }).first().click()

    // Filter should be applied - Clear button becomes visible
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
  })
})

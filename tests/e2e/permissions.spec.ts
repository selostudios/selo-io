import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsTeamMember, loginAsViewer, logout } from './helpers'

test.describe('Role-Based Access', () => {
  test('admin sees invite button on team page', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/settings/team')

    // Admin should see the invite button
    await expect(page.getByRole('button', { name: 'Invite Member' })).toBeVisible()
  })

  test('team member can access dashboard', async ({ page }) => {
    await loginAsTeamMember(page)

    await page.goto('/dashboard')
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible()
  })

  test('team member cannot access organization settings', async ({ page }) => {
    await loginAsTeamMember(page)

    await page.goto('/settings/organization')

    // Should either redirect away or show access denied
    // The settings page redirects non-admin users
    await expect(page).not.toHaveURL(/\/settings\/organization$/, { timeout: 5000 })
  })

  test('viewer can access dashboard', async ({ page }) => {
    await loginAsViewer(page)

    await page.goto('/dashboard')
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible()
  })

  test('logout redirects to login page', async ({ page }) => {
    await loginAsAdmin(page)

    await logout(page)
    await expect(page).toHaveURL('/login')
  })
})

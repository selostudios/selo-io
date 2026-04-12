import { Page } from '@playwright/test'
import { testUsers } from '../fixtures'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  // Login triggers a redirect chain that settles at /{orgId}/dashboard (non-internal
  // users) or /organizations (internal users). The proxy sets the selo-org cookie
  // when the browser hits /{orgId}/dashboard.
  await page.waitForURL(/\/(dashboard|organizations)/)
}

export async function loginAsAdmin(page: Page) {
  await login(page, testUsers.admin.email, testUsers.admin.password)
}

export async function loginAsTeamMember(page: Page) {
  await login(page, testUsers.teamMember.email, testUsers.teamMember.password)
}

export async function loginAsDeveloper(page: Page) {
  await login(page, testUsers.developer.email, testUsers.developer.password)
}

export async function loginAsViewer(page: Page) {
  await login(page, testUsers.viewer.email, testUsers.viewer.password)
}

export async function logout(page: Page) {
  // Click user menu
  await page.locator('[data-testid="user-menu-trigger"]').click()
  // Click sign out
  await page.locator('button[type="submit"]', { hasText: 'Sign out' }).click()
  await page.waitForURL('/login')
}

export async function gotoSettings(page: Page, tab: 'organization' | 'team' | 'integrations') {
  await page.click(`text=Settings`)
  await page.waitForURL(new RegExp(`/settings/${tab}`))
}

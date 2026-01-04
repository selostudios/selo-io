import { Page } from '@playwright/test'
import { testUsers } from '../fixtures'

export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', testUsers.admin.email)
  await page.fill('input[name="password"]', testUsers.admin.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

export async function loginAsTeamMember(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', testUsers.teamMember.email)
  await page.fill('input[name="password"]', testUsers.teamMember.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

export async function logout(page: Page) {
  // Click user menu
  await page.click('button:has(svg)')
  // Click sign out
  await page.click('text=Sign out')
  await page.waitForURL('/login')
}

export async function gotoSettings(page: Page, tab: 'organization' | 'team' | 'integrations') {
  await page.click(`text=Settings`)
  await page.waitForURL(`/settings/${tab}`)
}

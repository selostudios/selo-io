import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|organizations)/)
  // Navigate to / to resolve org and set selo-org cookie
  await page.goto('/')
  await page.waitForURL(/\/dashboard/)
}

/** Extract orgId from current URL (e.g., /{orgId}/dashboard → orgId) */
function getOrgId(page: import('@playwright/test').Page): string {
  const match = new URL(page.url()).pathname.match(/^\/([a-f0-9-]+)\//)
  if (!match) throw new Error(`Could not extract orgId from URL: ${page.url()}`)
  return match[1]
}

test.describe('Support Section - Access Control', () => {
  test('non-developer is redirected to dashboard', async ({ page }) => {
    await loginAs(page, testUsers.teamMember.email, testUsers.teamMember.password)
    const orgId = getOrgId(page)

    // Try to access support directly
    await page.goto(`/${orgId}/support`)

    // Should be redirected to dashboard (may include org prefix)
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

test.describe('Support Section - Developer Access', () => {
  test('developer can view support section', async ({ page }) => {
    await loginAs(page, testUsers.developer.email, testUsers.developer.password)
    const orgId = getOrgId(page)

    // Navigate to support
    await page.goto(`/${orgId}/support`)

    // Should remain on support page (not redirected)
    await expect(page).toHaveURL(/\/support/)

    // Should see support page heading
    await expect(page.getByRole('heading', { name: 'Support', level: 1 })).toBeVisible()
  })

  test('developer can filter feedback', async ({ page }) => {
    await loginAs(page, testUsers.developer.email, testUsers.developer.password)
    const orgId = getOrgId(page)

    await page.goto(`/${orgId}/support`)

    // Click status filter combobox
    const statusFilter = page.locator('[role="combobox"]').filter({ hasText: 'All Statuses' })
    await statusFilter.click()

    // Select New status from dropdown
    await page.locator('[role="option"]').filter({ hasText: /^New$/ }).first().click()

    // Filter should be applied - Clear button becomes visible
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
  })

  test.skip('developer can open feedback slideout', async ({ page }) => {
    // This requires seeded feedback data
    await loginAs(page, testUsers.developer.email, testUsers.developer.password)
    const orgId = getOrgId(page)

    await page.goto(`/${orgId}/support`)

    // Click on a feedback row (would need seeded data)
    // Slideout should open
  })
})

import type { SiteAuditPage } from './types'

const SOFT_404_TITLE_PATTERNS = [/\b404\b/i, /page\s+not\s+found/i, /not\s+found/i]

/**
 * Detect soft 404s based on page title patterns.
 * Only matches when the title strongly suggests an error page.
 */
export function isSoft404(title: string | null, statusCode: number | null): boolean {
  // Only check title on pages that returned 200 — actual 4xx/5xx are handled by status code
  if (statusCode !== null && statusCode !== 200) return false
  if (!title) return false

  return SOFT_404_TITLE_PATTERNS.some((pattern) => pattern.test(title))
}

/**
 * Returns true if a page should have SEO/technical checks run on it.
 * Excludes error pages (4xx/5xx) and soft 404s — these are still stored
 * for the broken-internal-links check but shouldn't trigger page-specific checks.
 */
export function isCheckablePage(page: Pick<SiteAuditPage, 'status_code' | 'title'>): boolean {
  const status = page.status_code ?? 200

  // Exclude 4xx and 5xx pages
  if (status >= 400) return false

  // Exclude soft 404s (200 status but error-page title)
  if (isSoft404(page.title, status)) return false

  return true
}

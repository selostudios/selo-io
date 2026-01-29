import * as cheerio from 'cheerio'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const canonicalValidation: AuditCheckDefinition = {
  name: 'canonical_validation',
  type: CheckType.SEO,
  priority: CheckPriority.Recommended,
  description: 'Canonical URLs should be valid, accessible, and self-referencing on unique pages',
  displayName: 'Invalid Canonical URL',
  displayNamePassed: 'Valid Canonical URLs',
  learnMoreUrl:
    'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const canonical = $('link[rel="canonical"]').attr('href')

    // If no canonical, this is handled by missing-canonical check
    if (!canonical || canonical.trim() === '') {
      return {
        status: CheckStatus.Passed,
        details: {
          message: 'No canonical tag (handled by separate check)',
        },
      }
    }

    const pageUrl = context.url
    const issues: string[] = []

    // Normalize URLs for comparison (remove trailing slashes, fragments)
    const normalizeUrl = (url: string): string => {
      try {
        const parsed = new URL(url)
        parsed.hash = '' // Remove fragment
        let normalized = parsed.href
        // Remove trailing slash unless it's just the domain
        if (normalized.endsWith('/') && parsed.pathname !== '/') {
          normalized = normalized.slice(0, -1)
        }
        return normalized
      } catch {
        return url
      }
    }

    let canonicalUrl: string
    try {
      // Handle relative canonical URLs
      canonicalUrl = new URL(canonical, pageUrl).href
    } catch {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Canonical URL is malformed: "${canonical}". Use absolute URLs for canonical tags.`,
          canonical,
        },
      }
    }

    const normalizedPage = normalizeUrl(pageUrl)
    const normalizedCanonical = normalizeUrl(canonicalUrl)

    // Check 1: Self-referencing canonical on unique pages (recommended)
    // For most pages, canonical should point to itself
    if (normalizedPage !== normalizedCanonical) {
      // This might be intentional (duplicate page pointing to original)
      // So we'll make this a warning, not a failure
      issues.push(
        `Canonical points to different URL: ${canonicalUrl} (current: ${pageUrl}). Ensure this is intentional for duplicate content.`
      )
    }

    // Check 2: Verify canonical URL is accessible (important)
    try {
      const canonicalResponse = await fetch(canonicalUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        redirect: 'manual',
      })

      const status = canonicalResponse.status

      if (status >= 400) {
        return {
          status: CheckStatus.Failed,
          details: {
            message: `Canonical URL returns ${status} error. Canonical must point to an accessible page.`,
            canonical: canonicalUrl,
            status,
          },
        }
      }

      if (status >= 300 && status < 400) {
        return {
          status: CheckStatus.Warning,
          details: {
            message: `Canonical URL redirects (${status}). Canonical should point directly to the final URL, not a redirect.`,
            canonical: canonicalUrl,
            status,
          },
        }
      }

      // Check 3: Verify the canonical target also has the same canonical (no canonical chains)
      const canonicalHtml = await fetch(canonicalUrl, {
        signal: AbortSignal.timeout(5000),
      }).then((r) => r.text())

      const $canonical = cheerio.load(canonicalHtml)
      const targetCanonical = $canonical('link[rel="canonical"]').attr('href')

      if (targetCanonical) {
        const targetCanonicalUrl = new URL(targetCanonical, canonicalUrl).href
        const normalizedTargetCanonical = normalizeUrl(targetCanonicalUrl)

        if (normalizedTargetCanonical !== normalizedCanonical) {
          return {
            status: CheckStatus.Failed,
            details: {
              message: `Canonical chain detected: Page points to ${canonicalUrl}, which points to ${targetCanonicalUrl}. Canonical should point directly to the final URL.`,
              canonical: canonicalUrl,
              targetCanonical: targetCanonicalUrl,
            },
          }
        }
      }
    } catch (error) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Could not verify canonical URL (${canonicalUrl}). Ensure it is accessible.`,
          canonical: canonicalUrl,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }

    // If we found issues but nothing critical
    if (issues.length > 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: issues.join(' '),
          canonical: canonicalUrl,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        message: `Canonical URL is valid and accessible: ${canonicalUrl}`,
        canonical: canonicalUrl,
      },
    }
  },
}

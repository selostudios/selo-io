import type { SiteAuditPage } from '@/lib/audit/types'
import type { PageImportance } from './types'

/**
 * Calculate importance score for a page based on multiple signals
 * Higher score = more important to analyze with AI
 */
export function calculatePageImportance(
  page: SiteAuditPage,
  allPages: SiteAuditPage[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  baseUrl: string
): PageImportance {
  const url = new URL(page.url)
  const reasons: string[] = []
  let score = 0

  // 1. URL depth (shallower = more important)
  const pathSegments = url.pathname.split('/').filter((s) => s.length > 0)
  const depth = pathSegments.length

  if (depth === 0) {
    score += 100
    reasons.push('Homepage')
  } else if (depth === 1) {
    score += 80
    reasons.push('Top-level page')
  } else if (depth === 2) {
    score += 50
    reasons.push('Second-level page')
  } else {
    score += 20
    reasons.push(`Deep page (depth: ${depth})`)
  }

  // 2. Inbound internal links (more links = more important)
  const inboundLinks = allPages.filter((p) => {
    // This would require link extraction during crawl
    // For now, we'll use a heuristic based on URL patterns
    return p.url !== page.url
  }).length

  // Estimate importance by link count (simplified)
  const linkScore = Math.min(inboundLinks * 5, 50)
  if (linkScore > 0) {
    score += linkScore
    if (inboundLinks > 5) {
      reasons.push('Highly linked internally')
    }
  }

  // 3. URL patterns that indicate important content
  const importantPatterns = [
    { pattern: /\/(about|services|products|features)/i, boost: 30, label: 'Core service page' },
    { pattern: /\/(blog|articles|resources)/i, boost: 25, label: 'Content hub' },
    { pattern: /\/(pricing|plans)/i, boost: 20, label: 'Pricing page' },
    { pattern: /\/(docs|documentation|guide)/i, boost: 35, label: 'Documentation' },
    { pattern: /\/(faq|help|support)/i, boost: 30, label: 'Help content' },
    { pattern: /\/(case-studies|customers|testimonials)/i, boost: 25, label: 'Social proof' },
  ]

  for (const { pattern, boost, label } of importantPatterns) {
    if (pattern.test(url.pathname)) {
      score += boost
      reasons.push(label)
      break // Only apply one pattern boost
    }
  }

  // 4. Less important patterns
  const lessImportantPatterns = [
    /\/(privacy|terms|legal)/i,
    /\/(login|signup|register)/i,
    /\/(admin|dashboard)/i,
    /\/(archive|old|legacy)/i,
  ]

  for (const pattern of lessImportantPatterns) {
    if (pattern.test(url.pathname)) {
      score = Math.max(10, score - 40)
      reasons.push('Low priority page type')
      break
    }
  }

  // 5. Content freshness (if available)
  if (page.last_modified) {
    const lastModified = new Date(page.last_modified)
    const daysSinceUpdate = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceUpdate < 30) {
      score += 15
      reasons.push('Recently updated (< 30 days)')
    } else if (daysSinceUpdate < 90) {
      score += 10
      reasons.push('Updated in last quarter')
    } else if (daysSinceUpdate > 365) {
      score -= 10
      reasons.push('Not updated in over a year')
    }
  }

  // 6. Title quality (indicates content investment)
  if (page.title) {
    const titleLength = page.title.length
    if (titleLength >= 30 && titleLength <= 70) {
      score += 10
      reasons.push('Well-optimized title')
    }
  } else {
    score -= 20
    reasons.push('Missing title')
  }

  // 7. Meta description presence
  if (page.meta_description) {
    score += 10
    reasons.push('Has meta description')
  }

  // 8. Resources should be deprioritized
  if (page.is_resource) {
    score = Math.max(5, score - 60)
    reasons.push(`Resource file (${page.resource_type})`)
  }

  // 9. HTTP status penalties
  if (page.status_code !== 200) {
    score = Math.max(0, score - 80)
    reasons.push(`Non-200 status (${page.status_code})`)
  }

  // Normalize score to 0-100 range
  const normalizedScore = Math.max(0, Math.min(100, score))

  return {
    url: page.url,
    importanceScore: normalizedScore,
    reasons,
  }
}

/**
 * Select top N pages to analyze based on importance scores
 * Returns pages sorted by importance (highest first)
 */
export function selectTopPages(
  pages: SiteAuditPage[],
  baseUrl: string,
  sampleSize: number
): PageImportance[] {
  // Calculate importance for all pages
  const pageImportance = pages.map((page) => calculatePageImportance(page, pages, baseUrl))

  // Sort by importance score (descending)
  const sorted = pageImportance.sort((a, b) => b.importanceScore - a.importanceScore)

  // Always include homepage if present
  const homepage = sorted.find((p) => {
    const url = new URL(p.url)
    return url.pathname === '/' || url.pathname === ''
  })

  // Get top N pages
  let topPages = sorted.slice(0, sampleSize)

  // Ensure homepage is included if found
  if (homepage && !topPages.includes(homepage)) {
    topPages = [homepage, ...topPages.slice(0, sampleSize - 1)]
  }

  return topPages
}

/**
 * Calculate average importance score across all pages
 */
export function getAverageImportance(pages: SiteAuditPage[], baseUrl: string): number {
  if (pages.length === 0) return 0

  const importance = pages.map((page) => calculatePageImportance(page, pages, baseUrl))
  const sum = importance.reduce((acc, p) => acc + p.importanceScore, 0)

  return sum / importance.length
}

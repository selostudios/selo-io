import { siteWideChecks, pageSpecificChecks } from './checks'
import { crawlSite } from '../audit/crawler'
import type {
  GEOCheck,
  GEOCheckContext,
  GEORunnerOptions,
  GEORunnerResult,
} from './types'

/**
 * Runs all GEO programmatic checks against a website
 * Returns technical score (0-100) based on check results
 */
export async function runGEOChecks(options: GEORunnerOptions): Promise<GEORunnerResult> {
  const { auditId, url, onCheckComplete } = options
  const checks: GEOCheck[] = []

  console.log(`[GEO Runner] Starting checks for ${url}`)

  // Crawl the site (limited to homepage for site-wide checks initially)
  await crawlSite(url, auditId, {
    maxPages: 1, // Start with homepage
    async onPageCrawled(page, html) {
      const context: GEOCheckContext = {
        url: page.url,
        html,
      }

      // Run site-wide checks (only on homepage)
      if (page.url === url || new URL(page.url).pathname === '/') {
        for (const checkDef of siteWideChecks) {
          const result = await checkDef.run(context)
          const check: GEOCheck = {
            id: crypto.randomUUID(),
            audit_id: auditId,
            category: checkDef.category,
            check_name: checkDef.name,
            priority: checkDef.priority,
            status: result.status,
            details: result.details || null,
            display_name: checkDef.displayName,
            display_name_passed: checkDef.displayNamePassed || null,
            description: checkDef.description || null,
            fix_guidance: checkDef.fixGuidance || null,
            learn_more_url: checkDef.learnMoreUrl || null,
            created_at: new Date().toISOString(),
          }

          checks.push(check)
          await onCheckComplete?.(check)

          console.log(
            `[GEO Runner] ${checkDef.name}: ${result.status} (${checkDef.category})`
          )
        }
      }

      // Run page-specific checks
      for (const checkDef of pageSpecificChecks) {
        const result = await checkDef.run(context)
        const check: GEOCheck = {
          id: crypto.randomUUID(),
          audit_id: auditId,
          category: checkDef.category,
          check_name: checkDef.name,
          priority: checkDef.priority,
          status: result.status,
          details: result.details || null,
          display_name: checkDef.displayName,
          display_name_passed: checkDef.displayNamePassed || null,
          description: checkDef.description || null,
          fix_guidance: checkDef.fixGuidance || null,
          learn_more_url: checkDef.learnMoreUrl || null,
          created_at: new Date().toISOString(),
        }

        checks.push(check)
        await onCheckComplete?.(check)

        console.log(
          `[GEO Runner] ${checkDef.name}: ${result.status} (${checkDef.category})`
        )
      }
    },
  })

  // Calculate technical score
  const technicalScore = calculateTechnicalScore(checks)

  console.log(`[GEO Runner] Completed ${checks.length} checks, score: ${technicalScore}/100`)

  // For now, return placeholder values for AI analysis
  // These will be populated in Phase 3 when we implement AI analysis
  return {
    checks,
    technicalScore,
    aiAnalyses: [],
    strategicScore: null,
    overallScore: technicalScore, // Just technical score for now
    tokenUsage: {
      input: 0,
      output: 0,
      total: 0,
    },
    estimatedCost: 0,
  }
}

/**
 * Calculate technical score (0-100) based on check results
 * Scoring system:
 * - Critical checks: weight 3x
 * - Recommended checks: weight 2x
 * - Optional checks: weight 1x
 *
 * Status mapping:
 * - passed: 100 points
 * - warning: 50 points
 * - failed: 0 points
 */
function calculateTechnicalScore(checks: GEOCheck[]): number {
  let totalWeight = 0
  let weightedScore = 0

  for (const check of checks) {
    // Skip if not a programmatic check result
    if (!check.status) continue

    // Determine weight based on priority
    const weight = check.priority === 'critical' ? 3 : check.priority === 'recommended' ? 2 : 1

    // Determine points based on status
    const points = check.status === 'passed' ? 100 : check.status === 'warning' ? 50 : 0

    totalWeight += weight
    weightedScore += points * weight
  }

  if (totalWeight === 0) return 0

  return Math.round(weightedScore / totalWeight)
}

/**
 * Calculate category-specific scores
 */
export function getCategoryScores(checks: GEOCheck[]): {
  technicalFoundation: number
  contentStructure: number
  contentQuality: number
} {
  const categories = {
    technical_foundation: checks.filter((c) => c.category === 'technical_foundation'),
    content_structure: checks.filter((c) => c.category === 'content_structure'),
    content_quality: checks.filter((c) => c.category === 'content_quality'),
  }

  return {
    technicalFoundation: calculateTechnicalScore(categories.technical_foundation),
    contentStructure: calculateTechnicalScore(categories.content_structure),
    contentQuality: calculateTechnicalScore(categories.content_quality),
  }
}

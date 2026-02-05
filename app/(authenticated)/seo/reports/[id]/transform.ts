import type { GeneratedReportWithAudits } from '@/lib/reports/types'
import type { ReportAuditData } from '../actions'
import type {
  ReportPresentationData,
  ReportOpportunity,
  ReportProjection,
  ReportRecommendation,
} from '@/lib/reports/types'
import {
  ReportPriority,
  ReportEffort,
  ReportOwner,
  AuditSource,
  CheckPriority,
  CheckStatus,
} from '@/lib/enums'
import { getScoreStatus, hasImprovementPotential } from '@/lib/reports'

/**
 * Transform raw audit data into presentation-ready format
 */
export function transformToPresentation(
  report: GeneratedReportWithAudits,
  auditData: ReportAuditData
): ReportPresentationData {
  const seoScore = report.site_audit.overall_score ?? 0
  const aioScore = report.aio_audit.overall_aio_score ?? 0

  // Calculate average performance score
  const perfScores = auditData.performanceResults
    .map((r) => r.performance_score)
    .filter((s): s is number => s !== null)
  const pageSpeedScore =
    perfScores.length > 0
      ? Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
      : 0

  // Transform opportunities from failed checks
  const opportunities = transformOpportunities(auditData)

  // Transform projections
  const projections = transformProjections(seoScore, pageSpeedScore, aioScore)

  // Transform recommendations
  const recommendations = transformRecommendations(auditData)

  // Branding: custom fields override organization defaults
  const logoUrl = report.custom_logo_url || report.org_logo_url || null
  const companyName = report.custom_company_name || report.org_name || null

  return {
    id: report.id,
    domain: report.domain,
    created_at: report.created_at,
    combined_score: report.combined_score ?? 0,
    logo_url: logoUrl,
    company_name: companyName,
    primary_color: report.primary_color ?? null,
    secondary_color: report.secondary_color ?? null,
    accent_color: report.accent_color ?? null,
    executive_summary: report.executive_summary ?? 'Summary not yet generated.',
    scores: {
      seo: { score: seoScore, status: getScoreStatus(seoScore) },
      page_speed: { score: pageSpeedScore, status: getScoreStatus(pageSpeedScore) },
      aio: { score: aioScore, status: getScoreStatus(aioScore) },
    },
    stats: {
      pages_analyzed: report.site_audit.pages_crawled,
      opportunities_found: opportunities.length,
      recommendations_count: recommendations.length,
    },
    opportunities,
    projections,
    recommendations,
  }
}

function transformOpportunities(auditData: ReportAuditData): ReportOpportunity[] {
  const opportunities: ReportOpportunity[] = []

  // SEO checks
  for (const check of auditData.siteChecks) {
    if (check.status === CheckStatus.Failed || check.status === CheckStatus.Warning) {
      opportunities.push({
        id: check.id,
        title: check.display_name || check.check_name.replace(/_/g, ' '),
        description: check.description || '',
        impact: getImpactDescription(check.check_name),
        fix: check.fix_guidance || '',
        priority: mapPriorityToReport(check.priority),
        source: AuditSource.SEO,
      })
    }
  }

  // AIO checks
  for (const check of auditData.aioChecks) {
    if (check.status === CheckStatus.Failed || check.status === CheckStatus.Warning) {
      opportunities.push({
        id: check.id,
        title: check.display_name || check.check_name.replace(/_/g, ' '),
        description: check.description || '',
        impact: getImpactDescription(check.check_name),
        fix: check.fix_guidance || '',
        priority: mapPriorityToReport(check.priority),
        source: AuditSource.AIO,
      })
    }
  }

  // Performance opportunities (from low scores)
  for (const result of auditData.performanceResults) {
    if (result.performance_score !== null && result.performance_score < 50) {
      opportunities.push({
        id: result.id,
        title: `Slow page performance on ${result.device}`,
        description: `Performance score of ${result.performance_score}/100 indicates significant optimization opportunities.`,
        impact: 'Slow pages can reduce conversions by up to 7% per second of delay.',
        fix: 'Optimize images, reduce JavaScript, and implement caching.',
        priority: ReportPriority.High,
        source: AuditSource.PageSpeed,
      })
    }
  }

  // Sort by priority
  const priorityOrder = {
    [ReportPriority.High]: 0,
    [ReportPriority.Medium]: 1,
    [ReportPriority.Low]: 2,
  }
  opportunities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return opportunities.slice(0, 12) // Limit for readability
}

function transformProjections(
  seoScore: number,
  pageSpeedScore: number,
  aioScore: number
): ReportProjection[] {
  return [
    {
      area: 'Search Visibility',
      current_value: `${seoScore}/100`,
      target_value: '85+/100',
      potential_impact: 'Improved rankings could increase organic traffic by 20-40%',
      show: hasImprovementPotential(seoScore, 85),
    },
    {
      area: 'Site Speed',
      current_value: `${pageSpeedScore}/100`,
      target_value: '85+/100',
      potential_impact: 'Faster pages typically see 2-3x improvement in conversion rates',
      show: hasImprovementPotential(pageSpeedScore, 85),
    },
    {
      area: 'AI Readiness',
      current_value: `${aioScore}/100`,
      target_value: '85+/100',
      potential_impact: 'Better AI visibility can increase mentions in AI-powered search',
      show: hasImprovementPotential(aioScore, 85),
    },
  ]
}

function transformRecommendations(auditData: ReportAuditData): ReportRecommendation[] {
  const recommendations: ReportRecommendation[] = []
  let rank = 1

  // High priority SEO issues
  const criticalSeoChecks = auditData.siteChecks.filter(
    (c) => c.priority === CheckPriority.Critical && c.status === CheckStatus.Failed
  )

  for (const check of criticalSeoChecks.slice(0, 3)) {
    recommendations.push({
      rank: rank++,
      title: getRecommendationTitle(check.check_name),
      impact: ReportPriority.High,
      effort: getEffortLevel(check.check_name),
      owner: getOwner(check.check_name),
      source: AuditSource.SEO,
    })
  }

  // Performance recommendations
  const slowResults = auditData.performanceResults.filter(
    (r) => r.performance_score !== null && r.performance_score < 60
  )
  if (slowResults.length > 0) {
    recommendations.push({
      rank: rank++,
      title: 'Optimize page load performance',
      impact: ReportPriority.High,
      effort: ReportEffort.Medium,
      owner: ReportOwner.Developer,
      source: AuditSource.PageSpeed,
    })
  }

  // AIO recommendations
  const criticalAioChecks = auditData.aioChecks.filter(
    (c) => c.priority === CheckPriority.Critical && c.status === CheckStatus.Failed
  )

  for (const check of criticalAioChecks.slice(0, 2)) {
    recommendations.push({
      rank: rank++,
      title: getRecommendationTitle(check.check_name),
      impact: ReportPriority.High,
      effort: getEffortLevel(check.check_name),
      owner: getOwner(check.check_name),
      source: AuditSource.AIO,
    })
  }

  // Medium priority items
  const recommendedChecks = [
    ...auditData.siteChecks.filter(
      (c) => c.priority === CheckPriority.Recommended && c.status === CheckStatus.Failed
    ),
    ...auditData.aioChecks.filter(
      (c) => c.priority === CheckPriority.Recommended && c.status === CheckStatus.Failed
    ),
  ]

  for (const check of recommendedChecks.slice(0, 3)) {
    recommendations.push({
      rank: rank++,
      title: getRecommendationTitle(check.check_name),
      impact: ReportPriority.Medium,
      effort: getEffortLevel(check.check_name),
      owner: getOwner(check.check_name),
      source: 'check_type' in check ? AuditSource.SEO : AuditSource.AIO,
    })
  }

  return recommendations.slice(0, 10)
}

function mapPriorityToReport(priority: CheckPriority): ReportPriority {
  switch (priority) {
    case CheckPriority.Critical:
      return ReportPriority.High
    case CheckPriority.Recommended:
      return ReportPriority.Medium
    case CheckPriority.Optional:
      return ReportPriority.Low
  }
}

function getImpactDescription(checkName: string): string {
  // Simplified impact descriptions
  const impacts: Record<string, string> = {
    'missing-meta-description': 'Lower click-through rates in search results',
    'missing-title': 'Pages may not appear in search results correctly',
    'missing-h1': 'Search engines may not understand page content',
    'broken-internal-links': 'Users and search engines cannot access linked content',
    'missing-sitemap': 'Search engines may miss important pages',
    'slow-page-response': 'Visitors may leave before content loads',
    'missing-structured-data': 'AI assistants cannot understand your content properly',
    'ai-crawlers-blocked': 'AI-powered search cannot index your content',
  }

  return impacts[checkName] || 'May impact search visibility and user experience'
}

function getRecommendationTitle(checkName: string): string {
  const titles: Record<string, string> = {
    'missing-meta-description': 'Add meta descriptions to all pages',
    'missing-title': 'Add title tags to all pages',
    'missing-h1': 'Add H1 headings to all pages',
    'broken-internal-links': 'Fix broken internal links',
    'missing-sitemap': 'Create and submit an XML sitemap',
    'missing-robots-txt': 'Configure robots.txt properly',
    'duplicate-titles': 'Make page titles unique',
    'missing-structured-data': 'Add structured data markup',
    'ai-crawlers-blocked': 'Allow AI crawlers in robots.txt',
    'missing-llms-txt': 'Add llms.txt for AI discovery',
    'slow-page-response': 'Improve server response time',
  }

  return titles[checkName] || checkName.replace(/_/g, ' ').replace(/-/g, ' ')
}

function getEffortLevel(checkName: string): ReportEffort {
  const quickWins = [
    'missing-meta-description',
    'missing-title',
    'missing-h1',
    'missing-robots-txt',
    'missing-llms-txt',
    'missing-viewport',
    'missing-og-tags',
  ]

  const majorProjects = ['broken-internal-links', 'js-rendered-content', 'missing-structured-data']

  if (quickWins.includes(checkName)) return ReportEffort.QuickWin
  if (majorProjects.includes(checkName)) return ReportEffort.Major
  return ReportEffort.Medium
}

function getOwner(checkName: string): ReportOwner {
  const developerTasks = [
    'missing-sitemap',
    'missing-robots-txt',
    'missing-structured-data',
    'slow-page-response',
    'js-rendered-content',
    'missing-ssl',
    'mixed-content',
    'missing-viewport',
  ]

  const contentTasks = ['missing-meta-description', 'thin-content', 'no-faq-content']

  if (developerTasks.includes(checkName)) return ReportOwner.Developer
  if (contentTasks.includes(checkName)) return ReportOwner.Content
  return ReportOwner.Marketing
}

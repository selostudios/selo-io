import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { SiteAudit, SiteAuditCheck } from './types'
import { getLogoDataUri } from '@/lib/pdf/logo'
import {
  CoverPage,
  SectionHeader,
  IssueTable,
  StatBar,
  PageFooter,
  ActionItem,
  ContactBox,
  PassedChecksSummary,
  baseStyles,
  colors,
  getScoreColor,
  type GroupedIssue,
} from '@/lib/pdf/components'

interface AuditPDFProps {
  audit: SiteAudit
  checks: SiteAuditCheck[]
}

function formatCheckName(check: SiteAuditCheck): string {
  return check.display_name || check.check_name.replace(/_/g, ' ')
}

function getCheckDescription(check: SiteAuditCheck): string {
  return check.description || ''
}

function getCheckFixGuidance(check: SiteAuditCheck): string {
  // Use explicit fix_guidance, or fallback to details.message
  if (check.fix_guidance) return check.fix_guidance
  if (check.details?.message && typeof check.details.message === 'string') {
    return check.details.message
  }
  return ''
}

function groupChecksByType(
  checks: SiteAuditCheck[]
): Record<string, { failed: SiteAuditCheck[]; passed: SiteAuditCheck[] }> {
  const groups: Record<string, { failed: SiteAuditCheck[]; passed: SiteAuditCheck[] }> = {
    seo: { failed: [], passed: [] },
    ai_readiness: { failed: [], passed: [] },
    technical: { failed: [], passed: [] },
  }

  for (const check of checks) {
    const type = check.check_type
    if (check.status === 'passed') {
      groups[type].passed.push(check)
    } else {
      groups[type].failed.push(check)
    }
  }

  return groups
}

function sortByPriority(checks: SiteAuditCheck[]): SiteAuditCheck[] {
  const priorityOrder = { critical: 0, recommended: 1, optional: 2 }
  return [...checks].sort(
    (a, b) =>
      priorityOrder[a.priority as keyof typeof priorityOrder] -
      priorityOrder[b.priority as keyof typeof priorityOrder]
  )
}

// Group checks by check_name to eliminate repetition
function groupChecksByName(checks: SiteAuditCheck[]): GroupedIssue[] {
  const groupMap = new Map<
    string,
    {
      name: string
      priority: 'critical' | 'recommended' | 'optional'
      count: number
      fixGuidance: string
    }
  >()

  for (const check of checks) {
    const key = check.check_name
    const existing = groupMap.get(key)

    if (existing) {
      existing.count++
      // Keep higher priority if mixed
      const priorityOrder = { critical: 0, recommended: 1, optional: 2 }
      if (
        priorityOrder[check.priority as keyof typeof priorityOrder] <
        priorityOrder[existing.priority]
      ) {
        existing.priority = check.priority as 'critical' | 'recommended' | 'optional'
      }
    } else {
      groupMap.set(key, {
        name: formatCheckName(check),
        priority: check.priority as 'critical' | 'recommended' | 'optional',
        count: 1,
        fixGuidance: getCheckFixGuidance(check) || getCheckDescription(check) || '',
      })
    }
  }

  // Convert to array and sort by priority then count
  const grouped = Array.from(groupMap.values())
  const priorityOrder = { critical: 0, recommended: 1, optional: 2 }
  return grouped.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return b.count - a.count // Higher count first within same priority
  })
}

function IssuesSection({
  title,
  issues,
  passedCount,
}: {
  title: string
  issues: SiteAuditCheck[]
  passedCount: number
}) {
  if (issues.length === 0 && passedCount === 0) return null

  // Group identical issues to eliminate repetition
  const groupedIssues = groupChecksByName(issues)
  const uniqueIssueCount = groupedIssues.length

  return (
    <View style={baseStyles.section}>
      <Text style={baseStyles.sectionSubtitle}>
        {title} ({issues.length} issue{issues.length !== 1 ? 's' : ''} across {uniqueIssueCount}{' '}
        type{uniqueIssueCount !== 1 ? 's' : ''})
      </Text>
      <IssueTable issues={groupedIssues} />
      {passedCount > 0 && <PassedChecksSummary count={passedCount} />}
    </View>
  )
}

export function AuditPDF({ audit, checks }: AuditPDFProps) {
  const logoUri = getLogoDataUri()
  const displayUrl = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const reportDate = new Date(audit.completed_at || audit.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Calculate stats
  const criticalFailed = checks.filter(
    (c) => c.priority === 'critical' && c.status === 'failed'
  ).length
  const totalFailed = checks.filter((c) => c.status !== 'passed').length
  const totalPassed = checks.filter((c) => c.status === 'passed').length

  // Group checks
  const groupedChecks = groupChecksByType(checks)

  // Get all failed checks for action plan, sorted by priority
  const allFailedChecks = sortByPriority(checks.filter((c) => c.status !== 'passed'))

  // Top actions - critical first, then highest priority recommended
  const topActions = allFailedChecks.slice(0, 5)

  return (
    <Document>
      {/* Page 1: Cover Page with Score */}
      <CoverPage
        logoUri={logoUri}
        title="Website Audit Report"
        subtitle={displayUrl}
        date={reportDate}
        score={audit.overall_score}
      />

      {/* Page 2: Executive Summary + Findings */}
      <Page size="A4" style={baseStyles.page}>
        <SectionHeader title="Executive Summary" />

        {audit.executive_summary && (
          <Text style={baseStyles.bodyText}>{audit.executive_summary}</Text>
        )}

        {/* Score Cards */}
        <View style={baseStyles.scoreCardsRow}>
          <View style={baseStyles.scoreCard}>
            <Text style={[baseStyles.scoreValue, { color: getScoreColor(audit.overall_score) }]}>
              {audit.overall_score ?? '-'}
            </Text>
            <Text style={baseStyles.scoreLabel}>Overall</Text>
          </View>
          <View style={baseStyles.scoreCard}>
            <Text style={[baseStyles.scoreValue, { color: getScoreColor(audit.seo_score) }]}>
              {audit.seo_score ?? '-'}
            </Text>
            <Text style={baseStyles.scoreLabel}>SEO</Text>
          </View>
          <View style={baseStyles.scoreCard}>
            <Text
              style={[baseStyles.scoreValue, { color: getScoreColor(audit.ai_readiness_score) }]}
            >
              {audit.ai_readiness_score ?? '-'}
            </Text>
            <Text style={baseStyles.scoreLabel}>AI Ready</Text>
          </View>
          <View style={baseStyles.scoreCard}>
            <Text style={[baseStyles.scoreValue, { color: getScoreColor(audit.technical_score) }]}>
              {audit.technical_score ?? '-'}
            </Text>
            <Text style={baseStyles.scoreLabel}>Technical</Text>
          </View>
        </View>

        {/* Stats Bar */}
        <StatBar
          stats={[
            { value: audit.pages_crawled, label: 'Pages Crawled' },
            { value: criticalFailed, label: 'Critical Issues', color: colors.error },
            { value: totalFailed, label: 'Total Issues', color: colors.warning },
            { value: totalPassed, label: 'Passed', color: colors.success },
          ]}
        />

        {/* Issues by Category */}
        <IssuesSection
          title="SEO Issues"
          issues={groupedChecks.seo.failed}
          passedCount={groupedChecks.seo.passed.length}
        />
        <IssuesSection
          title="AI-Readiness Issues"
          issues={groupedChecks.ai_readiness.failed}
          passedCount={groupedChecks.ai_readiness.passed.length}
        />
        <IssuesSection
          title="Technical Issues"
          issues={groupedChecks.technical.failed}
          passedCount={groupedChecks.technical.passed.length}
        />

        <PageFooter text={`${displayUrl} - Audit Report`} pageNumber={2} />
      </Page>

      {/* Page 3: Priority Action Plan */}
      <Page size="A4" style={baseStyles.page}>
        <SectionHeader title="Priority Actions" />

        {topActions.length > 0 ? (
          <>
            <Text style={baseStyles.bodyText}>
              Based on your audit results, here are the most important issues to address. Start with
              critical items first for maximum impact.
            </Text>

            <View style={baseStyles.actionList}>
              {topActions.map((check, index) => (
                <ActionItem
                  key={check.id}
                  number={index + 1}
                  text={`${formatCheckName(check)}: ${getCheckFixGuidance(check) || getCheckDescription(check) || 'Review and fix this issue.'}`}
                />
              ))}
            </View>

            {allFailedChecks.length > 5 && (
              <Text style={[baseStyles.smallText, { marginTop: 16 }]}>
                + {allFailedChecks.length - 5} additional issue
                {allFailedChecks.length - 5 !== 1 ? 's' : ''} to address
              </Text>
            )}
          </>
        ) : (
          <Text style={baseStyles.bodyText}>
            Congratulations! Your website passed all our checks. Continue maintaining best practices
            to keep your site performing well.
          </Text>
        )}

        <ContactBox title="Need Help Implementing These Changes?" />

        <PageFooter text={`${displayUrl} - Audit Report`} pageNumber={3} />
      </Page>
    </Document>
  )
}

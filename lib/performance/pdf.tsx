import { Document, Page, Text, View } from '@react-pdf/renderer'
import type {
  PerformanceAudit,
  PerformanceAuditResult,
  Opportunity,
  Diagnostic,
  PageSpeedResult,
} from './types'
import { extractOpportunities, extractDiagnostics } from './api'
import { getLogoDataUri } from '@/lib/pdf/logo'
import {
  CoverPage,
  SectionHeader,
  PageFooter,
  ContactBox,
  baseStyles,
  colors,
  getScoreColor,
} from '@/lib/pdf/components'
import { StyleSheet } from '@react-pdf/renderer'

// Performance-specific styles extending base styles
const perfStyles = StyleSheet.create({
  // Page header with domain and meta info
  pageHeader: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  pageMeta: {
    fontSize: 9,
    color: colors.textLight,
  },
  // Table styles
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderCell: {
    flex: 1,
    padding: 8,
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textLight,
    textTransform: 'uppercase',
  },
  tableHeaderCellFirst: {
    flex: 1.2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
  },
  tableCellFirst: {
    flex: 1.2,
    fontWeight: 'bold',
  },
  tableCellValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Core Web Vitals in table
  cwvRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  cwvCard: {
    flex: 1,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
  },
  cwvCardGood: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  cwvCardNeedsImprovement: {
    backgroundColor: '#fef9c3',
    borderColor: '#fde047',
  },
  cwvCardPoor: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  cwvLabel: {
    fontSize: 8,
    color: colors.textLight,
    marginBottom: 4,
  },
  cwvValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cwvTarget: {
    fontSize: 7,
    color: colors.textLight,
    marginTop: 2,
  },
  // Understanding scores (footer section)
  understandingSection: {
    position: 'absolute',
    bottom: 60,
    left: 40,
    right: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  understandingTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 6,
  },
  understandingText: {
    fontSize: 8,
    color: colors.textLight,
    lineHeight: 1.4,
  },
  // Opportunity/Diagnostic cards
  opportunityCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#fef9c3',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  diagnosticCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#6b7280',
  },
  opportunityTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 3,
  },
  opportunityDescription: {
    fontSize: 8,
    color: colors.text,
    lineHeight: 1.4,
    marginBottom: 3,
  },
  opportunitySavings: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#a16207',
  },
  noDataText: {
    fontSize: 9,
    color: colors.textLight,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  // Executive summary
  summaryScore: {
    alignItems: 'center',
    marginTop: 80,
  },
  summaryScoreValue: {
    fontSize: 72,
    fontWeight: 'bold',
  },
  summaryScoreLabel: {
    fontSize: 14,
    color: colors.textLight,
    textTransform: 'uppercase',
    marginTop: 8,
  },
})

interface PerformancePDFProps {
  audit: PerformanceAudit
  results: PerformanceAuditResult[]
}

// Performance uses 90/50 thresholds instead of 80/60
function getPerformanceScoreColor(score: number | null): string {
  return getScoreColor(score, { good: 90, fair: 50 })
}

function getCwvStyle(rating: string | null) {
  switch (rating) {
    case 'good':
      return perfStyles.cwvCardGood
    case 'needs_improvement':
      return perfStyles.cwvCardNeedsImprovement
    case 'poor':
      return perfStyles.cwvCardPoor
    default:
      return {}
  }
}

function getRatingColor(rating: string | null): string {
  switch (rating) {
    case 'good':
      return '#15803d'
    case 'needs_improvement':
      return '#a16207'
    case 'poor':
      return '#dc2626'
    default:
      return colors.textLight
  }
}

function formatLCP(value: number | null): string {
  if (value === null) return '—'
  return `${(value / 1000).toFixed(1)}s`
}

function formatINP(value: number | null): string {
  if (value === null) return '—'
  return `${value}ms`
}

function formatCLS(value: number | null): string {
  if (value === null) return '—'
  return value.toFixed(3)
}

function formatUrlDisplay(url: string): string {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace(/^www\./, '')
    const pathname = parsed.pathname
    // If home page, just show domain
    if (pathname === '/' || pathname === '') {
      return domain
    }
    // Otherwise show domain + path
    return `${domain}${pathname}`
  } catch {
    return url
  }
}

function ScoresTable({
  mobileResult,
  desktopResult,
}: {
  mobileResult: PerformanceAuditResult | null
  desktopResult: PerformanceAuditResult | null
}) {
  return (
    <View style={perfStyles.table}>
      {/* Header */}
      <View style={perfStyles.tableHeader}>
        <Text style={[perfStyles.tableHeaderCell, perfStyles.tableHeaderCellFirst]}>Device</Text>
        <Text style={perfStyles.tableHeaderCell}>Performance</Text>
        <Text style={perfStyles.tableHeaderCell}>Accessibility</Text>
        <Text style={perfStyles.tableHeaderCell}>Best Practices</Text>
        <Text style={perfStyles.tableHeaderCell}>SEO</Text>
      </View>

      {/* Mobile Row */}
      {mobileResult && (
        <View style={perfStyles.tableRow}>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellFirst]}>Mobile</Text>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellValue, { color: getPerformanceScoreColor(mobileResult.performance_score) }]}>
            {mobileResult.performance_score ?? '—'}
          </Text>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellValue, { color: getPerformanceScoreColor(mobileResult.accessibility_score) }]}>
            {mobileResult.accessibility_score ?? '—'}
          </Text>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellValue, { color: getPerformanceScoreColor(mobileResult.best_practices_score) }]}>
            {mobileResult.best_practices_score ?? '—'}
          </Text>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellValue, { color: getPerformanceScoreColor(mobileResult.seo_score) }]}>
            {mobileResult.seo_score ?? '—'}
          </Text>
        </View>
      )}

      {/* Desktop Row */}
      {desktopResult && (
        <View style={perfStyles.tableRow}>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellFirst]}>Desktop</Text>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellValue, { color: getPerformanceScoreColor(desktopResult.performance_score) }]}>
            {desktopResult.performance_score ?? '—'}
          </Text>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellValue, { color: getPerformanceScoreColor(desktopResult.accessibility_score) }]}>
            {desktopResult.accessibility_score ?? '—'}
          </Text>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellValue, { color: getPerformanceScoreColor(desktopResult.best_practices_score) }]}>
            {desktopResult.best_practices_score ?? '—'}
          </Text>
          <Text style={[perfStyles.tableCell, perfStyles.tableCellValue, { color: getPerformanceScoreColor(desktopResult.seo_score) }]}>
            {desktopResult.seo_score ?? '—'}
          </Text>
        </View>
      )}
    </View>
  )
}

function CoreWebVitalsRow({ result }: { result: PerformanceAuditResult }) {
  const hasLcp = result.lcp_ms !== null
  const hasInp = result.inp_ms !== null
  const hasCls = result.cls_score !== null

  if (!hasLcp && !hasInp && !hasCls) return null

  return (
    <View style={perfStyles.cwvRow}>
      {hasLcp && (
        <View style={[perfStyles.cwvCard, getCwvStyle(result.lcp_rating)]}>
          <Text style={perfStyles.cwvLabel}>LCP</Text>
          <Text style={[perfStyles.cwvValue, { color: getRatingColor(result.lcp_rating) }]}>
            {formatLCP(result.lcp_ms)}
          </Text>
          <Text style={perfStyles.cwvTarget}>Target: {'<'} 2.5s</Text>
        </View>
      )}
      {hasInp && (
        <View style={[perfStyles.cwvCard, getCwvStyle(result.inp_rating)]}>
          <Text style={perfStyles.cwvLabel}>INP</Text>
          <Text style={[perfStyles.cwvValue, { color: getRatingColor(result.inp_rating) }]}>
            {formatINP(result.inp_ms)}
          </Text>
          <Text style={perfStyles.cwvTarget}>Target: {'<'} 200ms</Text>
        </View>
      )}
      {hasCls && (
        <View style={[perfStyles.cwvCard, getCwvStyle(result.cls_rating)]}>
          <Text style={perfStyles.cwvLabel}>CLS</Text>
          <Text style={[perfStyles.cwvValue, { color: getRatingColor(result.cls_rating) }]}>
            {formatCLS(result.cls_score)}
          </Text>
          <Text style={perfStyles.cwvTarget}>Target: {'<'} 0.1</Text>
        </View>
      )}
    </View>
  )
}

function UnderstandingScores() {
  return (
    <View style={perfStyles.understandingSection}>
      <Text style={perfStyles.understandingTitle}>Understanding Your Scores</Text>
      <Text style={perfStyles.understandingText}>
        Performance (0-100): How fast your page loads. Aim for 90+. • LCP: Time until main content visible ({'<'}2.5s). • INP: Response time to interactions ({'<'}200ms). • CLS: Visual stability ({'<'}0.1).
      </Text>
    </View>
  )
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  // Clean up description - remove markdown links and truncate
  const cleanDescription = opportunity.description
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .substring(0, 200)

  return (
    <View style={perfStyles.opportunityCard}>
      <Text style={perfStyles.opportunityTitle}>{opportunity.title}</Text>
      <Text style={perfStyles.opportunityDescription}>{cleanDescription}</Text>
      {opportunity.displayValue && (
        <Text style={perfStyles.opportunitySavings}>Potential savings: {opportunity.displayValue}</Text>
      )}
    </View>
  )
}

function DiagnosticCard({ diagnostic }: { diagnostic: Diagnostic }) {
  // Clean up description - remove markdown links and truncate
  const cleanDescription = diagnostic.description
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .substring(0, 200)

  return (
    <View style={perfStyles.diagnosticCard}>
      <Text style={perfStyles.opportunityTitle}>{diagnostic.title}</Text>
      <Text style={perfStyles.opportunityDescription}>{cleanDescription}</Text>
      {diagnostic.displayValue && (
        <Text style={[perfStyles.opportunitySavings, { color: colors.textLight }]}>
          {diagnostic.displayValue}
        </Text>
      )}
    </View>
  )
}


export function PerformancePDF({ audit, results }: PerformancePDFProps) {
  const logoUri = getLogoDataUri()

  // Group results by URL
  const resultsByUrl = results.reduce(
    (acc, result) => {
      if (!acc[result.url]) {
        acc[result.url] = { mobile: null, desktop: null }
      }
      acc[result.url][result.device] = result
      return acc
    },
    {} as Record<
      string,
      { mobile: PerformanceAuditResult | null; desktop: PerformanceAuditResult | null }
    >
  )

  const urls = Object.keys(resultsByUrl)
  const reportDate = new Date(audit.completed_at || audit.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Calculate overall stats
  const mobileResults = results.filter((r) => r.device === 'mobile')
  const avgPerformance =
    mobileResults.length > 0
      ? Math.round(
          mobileResults.reduce((sum, r) => sum + (r.performance_score || 0), 0) /
            mobileResults.length
        )
      : null

  return (
    <Document>
      {/* Page 1: Cover Page - White, clean */}
      <CoverPage
        logoUri={logoUri}
        title="Performance Audit Report"
        date={reportDate}
        variant="light"
      />

      {/* Page 2: Executive Summary - Just the score */}
      <Page size="A4" style={baseStyles.page}>
        <SectionHeader title="Executive Summary" />

        <View style={perfStyles.summaryScore}>
          <Text style={[perfStyles.summaryScoreValue, { color: getPerformanceScoreColor(avgPerformance) }]}>
            {avgPerformance ?? '—'}
          </Text>
          <Text style={perfStyles.summaryScoreLabel}>Average Performance Score</Text>
        </View>

        <PageFooter text="Performance Audit Report" pageNumber={2} />
      </Page>

      {/* Page Results - One page per URL with table layout */}
      {urls.map((url, index) => {
        const mobileResult = resultsByUrl[url].mobile
        const desktopResult = resultsByUrl[url].desktop

        return (
          <Page key={url} size="A4" style={baseStyles.page}>
            <SectionHeader title="Page Results" />

            {/* Page Header with domain and meta info */}
            <View style={perfStyles.pageHeader}>
              <Text style={perfStyles.pageTitle}>{formatUrlDisplay(url)}</Text>
              <Text style={perfStyles.pageMeta}>
                {urls.length} page{urls.length !== 1 ? 's' : ''} tested · {results.length} total tests
              </Text>
            </View>

            {/* Scores Table */}
            <ScoresTable mobileResult={mobileResult} desktopResult={desktopResult} />

            {/* Core Web Vitals - show mobile metrics if available */}
            {mobileResult && <CoreWebVitalsRow result={mobileResult} />}

            {/* Understanding Scores - smaller at bottom */}
            <UnderstandingScores />

            <PageFooter text="Performance Audit Report" pageNumber={index + 3} />
          </Page>
        )
      })}

      {/* Opportunities & Diagnostics Pages */}
      {urls.map((url, index) => {
        const mobileResult = resultsByUrl[url].mobile
        if (!mobileResult?.raw_response) return null

        const opportunities = extractOpportunities(mobileResult.raw_response as unknown as PageSpeedResult)
        const diagnostics = extractDiagnostics(mobileResult.raw_response as unknown as PageSpeedResult)

        if (opportunities.length === 0 && diagnostics.length === 0) return null

        return (
          <Page key={`issues-${url}`} size="A4" style={baseStyles.page}>
            <SectionHeader title="Developer Action Items" />

            <View style={perfStyles.pageHeader}>
              <Text style={perfStyles.pageTitle}>{formatUrlDisplay(url)}</Text>
            </View>

            {opportunities.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={baseStyles.sectionSubtitle}>Optimization Opportunities</Text>
                <Text style={perfStyles.noDataText}>
                  Sorted by potential performance impact
                </Text>
                {opportunities.slice(0, 6).map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </View>
            )}

            {diagnostics.length > 0 && (
              <View>
                <Text style={baseStyles.sectionSubtitle}>Diagnostics</Text>
                {diagnostics.slice(0, 4).map((diag) => (
                  <DiagnosticCard key={diag.id} diagnostic={diag} />
                ))}
              </View>
            )}

            <PageFooter text="Performance Audit Report" pageNumber={urls.length + index + 3} />
          </Page>
        )
      })}

      {/* Contact Page */}
      <Page size="A4" style={baseStyles.page}>
        <SectionHeader title="Next Steps" />

        <Text style={baseStyles.bodyText}>
          This report identifies specific performance issues that can be addressed by your development
          team. Each opportunity includes the potential savings and technical details needed for
          implementation.
        </Text>

        <ContactBox title="Need Help Improving Performance?" />

        <PageFooter text="Performance Audit Report" />
      </Page>
    </Document>
  )
}

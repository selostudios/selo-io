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
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'column',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  metricCardGood: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  metricCardNeedsImprovement: {
    backgroundColor: '#fef9c3',
    borderColor: '#fde047',
  },
  metricCardPoor: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  metricCardNoData: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e5e5e5',
  },
  metricName: {
    fontSize: 10,
    color: colors.textLight,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  metricTarget: {
    fontSize: 8,
    color: colors.textLight,
    marginBottom: 4,
  },
  metricRating: {
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 2,
  },
  deviceLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 8,
    marginTop: 12,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    color: colors.primary,
    backgroundColor: colors.secondary,
    padding: 10,
    borderRadius: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
  },
  bullet: {
    fontSize: 10,
    marginRight: 8,
    color: colors.textLight,
  },
  bulletText: {
    fontSize: 10,
    color: colors.text,
    flex: 1,
    lineHeight: 1.5,
  },
  opportunityCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fef9c3',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  diagnosticCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#6b7280',
  },
  opportunityTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  opportunityDescription: {
    fontSize: 9,
    color: colors.text,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  opportunitySavings: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#a16207',
  },
  noDataText: {
    fontSize: 10,
    color: colors.textLight,
    fontStyle: 'italic',
    marginBottom: 12,
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

function getRatingStyle(rating: string | null) {
  switch (rating) {
    case 'good':
      return perfStyles.metricCardGood
    case 'needs_improvement':
      return perfStyles.metricCardNeedsImprovement
    case 'poor':
      return perfStyles.metricCardPoor
    default:
      return perfStyles.metricCardNoData
  }
}

function getRatingLabel(rating: string | null): string {
  switch (rating) {
    case 'good':
      return 'Good'
    case 'needs_improvement':
      return 'Needs Improvement'
    case 'poor':
      return 'Poor'
    default:
      return 'No Data'
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

function getPathname(url: string): string {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return url
  }
}

function CoreWebVitalsSection({ result }: { result: PerformanceAuditResult }) {
  const hasLcp = result.lcp_ms !== null
  const hasInp = result.inp_ms !== null
  const hasCls = result.cls_score !== null
  const hasAnyMetric = hasLcp || hasInp || hasCls

  if (!hasAnyMetric) {
    return null
  }

  return (
    <View style={perfStyles.metricsRow}>
      {hasLcp && (
        <View style={[perfStyles.metricCard, getRatingStyle(result.lcp_rating)]}>
          <Text style={perfStyles.metricName}>LCP (Largest Contentful Paint)</Text>
          <Text style={[perfStyles.metricValue, { color: getRatingColor(result.lcp_rating) }]}>
            {formatLCP(result.lcp_ms)}
          </Text>
          <Text style={perfStyles.metricTarget}>Target: {'<'} 2.5s</Text>
          <Text style={[perfStyles.metricRating, { color: getRatingColor(result.lcp_rating) }]}>
            {getRatingLabel(result.lcp_rating)}
          </Text>
        </View>
      )}
      {hasInp && (
        <View style={[perfStyles.metricCard, getRatingStyle(result.inp_rating)]}>
          <Text style={perfStyles.metricName}>INP (Interaction to Next Paint)</Text>
          <Text style={[perfStyles.metricValue, { color: getRatingColor(result.inp_rating) }]}>
            {formatINP(result.inp_ms)}
          </Text>
          <Text style={perfStyles.metricTarget}>Target: {'<'} 200ms</Text>
          <Text style={[perfStyles.metricRating, { color: getRatingColor(result.inp_rating) }]}>
            {getRatingLabel(result.inp_rating)}
          </Text>
        </View>
      )}
      {hasCls && (
        <View style={[perfStyles.metricCard, getRatingStyle(result.cls_rating)]}>
          <Text style={perfStyles.metricName}>CLS (Cumulative Layout Shift)</Text>
          <Text style={[perfStyles.metricValue, { color: getRatingColor(result.cls_rating) }]}>
            {formatCLS(result.cls_score)}
          </Text>
          <Text style={perfStyles.metricTarget}>Target: {'<'} 0.1</Text>
          <Text style={[perfStyles.metricRating, { color: getRatingColor(result.cls_rating) }]}>
            {getRatingLabel(result.cls_rating)}
          </Text>
        </View>
      )}
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

function LighthouseScoresSection({ result }: { result: PerformanceAuditResult }) {
  return (
    <View style={baseStyles.scoreCardsRow}>
      <View style={baseStyles.scoreCard}>
        <Text
          style={[
            baseStyles.scoreValue,
            { color: getPerformanceScoreColor(result.performance_score) },
          ]}
        >
          {result.performance_score ?? '—'}
        </Text>
        <Text style={baseStyles.scoreLabel}>Performance</Text>
      </View>
      <View style={baseStyles.scoreCard}>
        <Text
          style={[
            baseStyles.scoreValue,
            { color: getPerformanceScoreColor(result.accessibility_score) },
          ]}
        >
          {result.accessibility_score ?? '—'}
        </Text>
        <Text style={baseStyles.scoreLabel}>Accessibility</Text>
      </View>
      <View style={baseStyles.scoreCard}>
        <Text
          style={[
            baseStyles.scoreValue,
            { color: getPerformanceScoreColor(result.best_practices_score) },
          ]}
        >
          {result.best_practices_score ?? '—'}
        </Text>
        <Text style={baseStyles.scoreLabel}>Best Practices</Text>
      </View>
      <View style={baseStyles.scoreCard}>
        <Text
          style={[baseStyles.scoreValue, { color: getPerformanceScoreColor(result.seo_score) }]}
        >
          {result.seo_score ?? '—'}
        </Text>
        <Text style={baseStyles.scoreLabel}>SEO</Text>
      </View>
    </View>
  )
}

function PageResultSection({
  url,
  mobileResult,
  desktopResult,
}: {
  url: string
  mobileResult: PerformanceAuditResult | null
  desktopResult: PerformanceAuditResult | null
}) {
  return (
    <View style={baseStyles.section}>
      <Text style={perfStyles.pageTitle}>{getPathname(url)}</Text>

      {mobileResult && (
        <>
          <Text style={perfStyles.deviceLabel}>Mobile</Text>
          <LighthouseScoresSection result={mobileResult} />
          <CoreWebVitalsSection result={mobileResult} />
        </>
      )}

      {desktopResult && (
        <>
          <Text style={perfStyles.deviceLabel}>Desktop</Text>
          <LighthouseScoresSection result={desktopResult} />
          <CoreWebVitalsSection result={desktopResult} />
        </>
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
      {/* Page 1: Cover Page */}
      <CoverPage
        logoUri={logoUri}
        title="Performance Audit Report"
        subtitle={`${urls.length} pages analyzed`}
        date={reportDate}
        score={avgPerformance}
      />

      {/* Page 2: Summary Page */}
      <Page size="A4" style={baseStyles.page}>
        <SectionHeader title="Executive Summary" />

        <View style={baseStyles.scoreCardsRow}>
          <View style={baseStyles.scoreCard}>
            <Text
              style={[baseStyles.scoreValue, { color: getPerformanceScoreColor(avgPerformance) }]}
            >
              {avgPerformance ?? '—'}
            </Text>
            <Text style={baseStyles.scoreLabel}>Avg Performance</Text>
          </View>
          <View style={baseStyles.scoreCard}>
            <Text style={baseStyles.scoreValue}>{urls.length}</Text>
            <Text style={baseStyles.scoreLabel}>Pages Tested</Text>
          </View>
          <View style={baseStyles.scoreCard}>
            <Text style={baseStyles.scoreValue}>{results.length}</Text>
            <Text style={baseStyles.scoreLabel}>Total Tests</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={baseStyles.sectionSubtitle}>Understanding Your Scores</Text>

          <View style={perfStyles.bulletItem}>
            <Text style={perfStyles.bullet}>•</Text>
            <Text style={perfStyles.bulletText}>
              <Text style={{ fontWeight: 'bold' }}>Performance (0-100):</Text> Measures how fast
              your page loads and becomes interactive. Aim for 90+.
            </Text>
          </View>

          <View style={perfStyles.bulletItem}>
            <Text style={perfStyles.bullet}>•</Text>
            <Text style={perfStyles.bulletText}>
              <Text style={{ fontWeight: 'bold' }}>LCP (Largest Contentful Paint):</Text> Time until
              the main content is visible. Should be under 2.5 seconds.
            </Text>
          </View>

          <View style={perfStyles.bulletItem}>
            <Text style={perfStyles.bullet}>•</Text>
            <Text style={perfStyles.bulletText}>
              <Text style={{ fontWeight: 'bold' }}>INP (Interaction to Next Paint):</Text> How
              quickly the page responds to user interactions. Should be under 200ms.
            </Text>
          </View>

          <View style={perfStyles.bulletItem}>
            <Text style={perfStyles.bullet}>•</Text>
            <Text style={perfStyles.bulletText}>
              <Text style={{ fontWeight: 'bold' }}>CLS (Cumulative Layout Shift):</Text> Visual
              stability - how much content shifts unexpectedly. Should be under 0.1.
            </Text>
          </View>
        </View>

        <PageFooter text="Performance Audit Report" pageNumber={2} />
      </Page>

      {/* Results Pages */}
      {urls.map((url, index) => (
        <Page key={url} size="A4" style={baseStyles.page}>
          <SectionHeader title="Page Results" />

          <PageResultSection
            url={url}
            mobileResult={resultsByUrl[url].mobile}
            desktopResult={resultsByUrl[url].desktop}
          />

          <PageFooter text="Performance Audit Report" pageNumber={index + 3} />
        </Page>
      ))}

      {/* Opportunities & Diagnostics Pages - one per URL with issues */}
      {urls.map((url, index) => {
        const mobileResult = resultsByUrl[url].mobile
        if (!mobileResult?.raw_response) return null

        const opportunities = extractOpportunities(mobileResult.raw_response as unknown as PageSpeedResult)
        const diagnostics = extractDiagnostics(mobileResult.raw_response as unknown as PageSpeedResult)

        if (opportunities.length === 0 && diagnostics.length === 0) return null

        return (
          <Page key={`issues-${url}`} size="A4" style={baseStyles.page}>
            <SectionHeader title="Developer Action Items" />
            <Text style={perfStyles.pageTitle}>{getPathname(url)}</Text>

            {opportunities.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={baseStyles.sectionSubtitle}>Optimization Opportunities</Text>
                <Text style={perfStyles.noDataText}>
                  Issues sorted by potential performance impact
                </Text>
                {opportunities.slice(0, 5).map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </View>
            )}

            {diagnostics.length > 0 && (
              <View>
                <Text style={baseStyles.sectionSubtitle}>Diagnostics</Text>
                <Text style={perfStyles.noDataText}>
                  Additional metrics and insights for debugging
                </Text>
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

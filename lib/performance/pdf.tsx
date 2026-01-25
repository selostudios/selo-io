import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import type { PerformanceAudit, PerformanceAuditResult, PageSpeedResult } from './types'
import { extractOpportunities, extractAdditionalMetrics } from './api'
import { getLogoDataUri } from '@/lib/pdf/logo'
import { StyleSheet } from '@react-pdf/renderer'

// ============================================================================
// SELO STUDIOS - PERFORMANCE AUDIT REPORT
// ============================================================================

// Brand Colors
const colors = {
  black: '#1a1a1a',
  darkGray: '#333333',
  mediumGray: '#666666',
  lightGray: '#999999',
  borderGray: '#e5e5e5',
  backgroundGray: '#f8f8f8',
  white: '#ffffff',
  gold: '#d4a853',
  goldLight: '#f5e6c8',
  scoreGood: '#22c55e',
  scoreOkay: '#d4a853',
  scorePoor: '#ef4444',
}

// Helper functions
const getScoreColor = (score: number | null) => {
  if (score === null) return colors.lightGray
  if (score >= 90) return colors.scoreGood
  if (score >= 50) return colors.scoreOkay
  return colors.scorePoor
}

const getScoreLabel = (score: number | null) => {
  if (score === null) return 'No Data'
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Needs Improvement'
  if (score >= 50) return 'Poor'
  return 'Critical'
}

const formatMs = (ms: number | null) => {
  if (ms === null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

const formatBytes = (bytes: number | null) => {
  if (bytes === null) return '—'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / 1024).toFixed(0)}KB`
}

const formatSavingsDisplay = (displayValue: string): string => {
  // Parse time values like "14,772.1 s" or "1.5 s" or "500 ms"
  const timeMatch = displayValue.match(/([\d,.]+)\s*(s|ms)/i)
  if (timeMatch) {
    const value = parseFloat(timeMatch[1].replace(/,/g, ''))
    const unit = timeMatch[2].toLowerCase()

    // Convert to seconds
    const seconds = unit === 'ms' ? value / 1000 : value

    if (seconds >= 60) {
      const minutes = seconds / 60
      if (minutes >= 60) {
        const hours = Math.round(minutes / 60)
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
      }
      const mins = Math.round(minutes)
      return `${mins} ${mins === 1 ? 'min' : 'mins'}`
    }
    return `${Math.round(seconds)}s`
  }

  // Return as-is if not a time value (e.g., "500 KB")
  return displayValue
}

const formatUrlDisplay = (url: string): string => {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace(/^www\./, '')
    const pathname = parsed.pathname
    if (pathname === '/' || pathname === '') return domain
    return `${domain}${pathname}`
  } catch {
    return url
  }
}

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Styles
const styles = StyleSheet.create({
  // Page
  page: {
    backgroundColor: colors.white,
    paddingHorizontal: 50,
    paddingVertical: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.darkGray,
    lineHeight: 1.5,
  },

  // Cover Page
  coverPage: {
    backgroundColor: colors.white,
    padding: 50,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  logoContainer: {
    marginBottom: 60,
  },
  logo: {
    width: 80,
    height: 80,
  },
  coverTitle: {
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
    marginBottom: 12,
    textAlign: 'center',
  },
  coverClient: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: colors.gold,
    marginTop: 40,
    textAlign: 'center',
  },
  coverDate: {
    fontSize: 12,
    color: colors.lightGray,
    marginTop: 8,
    textAlign: 'center',
  },
  coverFooter: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    right: 50,
    textAlign: 'center',
  },
  coverFooterText: {
    fontSize: 9,
    color: colors.lightGray,
  },

  // Headers
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  headerLogo: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    color: colors.black,
  },
  headerPage: {
    fontSize: 9,
    color: colors.lightGray,
  },

  // Section Titles
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
    marginBottom: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.darkGray,
    marginBottom: 12,
    marginTop: 20,
  },

  // Executive Summary
  executiveSummaryBox: {
    backgroundColor: colors.backgroundGray,
    padding: 25,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  summaryHeadline: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 11,
    color: colors.darkGray,
    lineHeight: 1.6,
    marginBottom: 10,
  },

  // Score Display
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  bigScoreBox: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.backgroundGray,
    borderRadius: 8,
  },
  bigScoreNumber: {
    fontSize: 72,
    fontFamily: 'Helvetica-Bold',
  },
  bigScoreLabel: {
    fontSize: 12,
    color: colors.mediumGray,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  scoreDescription: {
    fontSize: 11,
    color: colors.darkGray,
    textAlign: 'center',
    marginTop: 15,
    maxWidth: 400,
  },

  // Key Findings
  findingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 15,
    gap: 15,
  },
  findingCard: {
    width: '47%',
    backgroundColor: colors.backgroundGray,
    padding: 15,
    marginBottom: 10,
  },
  findingTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
    marginBottom: 6,
  },
  findingValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  findingDescription: {
    fontSize: 9,
    color: colors.mediumGray,
    lineHeight: 1.4,
  },

  // Results Table
  table: {
    marginTop: 15,
    marginBottom: 25,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.black,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  tableRowAlt: {
    backgroundColor: colors.backgroundGray,
  },
  tableCell: {
    fontSize: 10,
    color: colors.darkGray,
  },
  tableCellBold: {
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
  },

  // Explainer Box
  explainerBox: {
    backgroundColor: colors.goldLight,
    padding: 20,
    marginVertical: 20,
    borderRadius: 4,
  },
  explainerTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
    marginBottom: 10,
  },
  explainerText: {
    fontSize: 10,
    color: colors.darkGray,
    lineHeight: 1.6,
  },

  // Glossary
  glossaryItem: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  glossaryTerm: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
    marginBottom: 4,
  },
  glossaryDefinition: {
    fontSize: 10,
    color: colors.mediumGray,
    lineHeight: 1.5,
  },
  glossaryAnalogy: {
    fontSize: 10,
    color: colors.gold,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Action Items
  actionItem: {
    marginBottom: 20,
    paddingLeft: 15,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  actionPriority: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
    backgroundColor: colors.scorePoor,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionPriorityMedium: {
    backgroundColor: colors.gold,
  },
  actionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
    marginBottom: 6,
  },
  actionDescription: {
    fontSize: 10,
    color: colors.mediumGray,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  actionImpact: {
    fontSize: 9,
    color: colors.darkGray,
    backgroundColor: colors.backgroundGray,
    padding: 10,
  },
  actionImpactLabel: {
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
  },

  // Business Impact
  impactBox: {
    flexDirection: 'row',
    marginVertical: 20,
  },
  impactStat: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.backgroundGray,
    marginHorizontal: 5,
  },
  impactNumber: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: colors.gold,
    marginBottom: 5,
  },
  impactLabel: {
    fontSize: 9,
    color: colors.mediumGray,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // CTA
  ctaBox: {
    backgroundColor: colors.black,
    padding: 35,
    marginTop: 30,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 11,
    color: colors.lightGray,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 400,
    lineHeight: 1.6,
  },
  ctaContact: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  ctaContactItem: {
    alignItems: 'center',
  },
  ctaContactLabel: {
    fontSize: 8,
    color: colors.lightGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  ctaContactValue: {
    fontSize: 11,
    color: colors.gold,
    fontFamily: 'Helvetica-Bold',
  },

  // Footer
  pageFooter: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderGray,
    paddingTop: 15,
  },
  footerText: {
    fontSize: 8,
    color: colors.lightGray,
  },

  // Paragraph & List
  paragraph: {
    fontSize: 10,
    color: colors.darkGray,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
  },
  listBullet: {
    width: 15,
    fontSize: 10,
    color: colors.gold,
  },
  listText: {
    flex: 1,
    fontSize: 10,
    color: colors.darkGray,
    lineHeight: 1.5,
  },

  // Per-page results
  pageResultCard: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  pageResultUrl: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.black,
    marginBottom: 10,
  },
  pageResultScores: {
    flexDirection: 'row',
    gap: 10,
  },
  pageResultScore: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.backgroundGray,
  },
  pageResultScoreValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
  },
  pageResultScoreLabel: {
    fontSize: 7,
    color: colors.mediumGray,
    textTransform: 'uppercase',
    marginTop: 4,
  },
})

// ============================================================================
// COMPONENTS
// ============================================================================

interface PageHeaderProps {
  pageNumber: number
  totalPages: number
}

function PageHeader({ pageNumber, totalPages }: PageHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <Text style={styles.headerLogo}>SELO STUDIOS</Text>
      <Text style={styles.headerPage}>
        Performance Audit Report • Page {pageNumber} of {totalPages}
      </Text>
    </View>
  )
}

interface PageFooterProps {
  clientDomain: string
}

function PageFooter({ clientDomain }: PageFooterProps) {
  return (
    <View style={styles.pageFooter}>
      <Text style={styles.footerText}>Confidential • Prepared for {clientDomain}</Text>
      <Text style={styles.footerText}>selostudios.com</Text>
    </View>
  )
}

// ============================================================================
// MAIN DOCUMENT COMPONENT
// ============================================================================

interface PerformancePDFProps {
  audit: PerformanceAudit
  results: PerformanceAuditResult[]
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
  const firstUrl = urls[0] || ''
  const clientDomain = getDomain(firstUrl)

  const reportDate = new Date(audit.completed_at || audit.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Calculate aggregate scores from mobile results (primary focus)
  const mobileResults = results.filter((r) => r.device === 'mobile')
  const desktopResults = results.filter((r) => r.device === 'desktop')

  const avgMobileScores = {
    performance:
      mobileResults.length > 0
        ? Math.round(
            mobileResults.reduce((sum, r) => sum + (r.performance_score || 0), 0) /
              mobileResults.length
          )
        : null,
    accessibility:
      mobileResults.length > 0
        ? Math.round(
            mobileResults.reduce((sum, r) => sum + (r.accessibility_score || 0), 0) /
              mobileResults.length
          )
        : null,
    bestPractices:
      mobileResults.length > 0
        ? Math.round(
            mobileResults.reduce((sum, r) => sum + (r.best_practices_score || 0), 0) /
              mobileResults.length
          )
        : null,
    seo:
      mobileResults.length > 0
        ? Math.round(
            mobileResults.reduce((sum, r) => sum + (r.seo_score || 0), 0) / mobileResults.length
          )
        : null,
  }

  const avgDesktopScores = {
    performance:
      desktopResults.length > 0
        ? Math.round(
            desktopResults.reduce((sum, r) => sum + (r.performance_score || 0), 0) /
              desktopResults.length
          )
        : null,
    accessibility:
      desktopResults.length > 0
        ? Math.round(
            desktopResults.reduce((sum, r) => sum + (r.accessibility_score || 0), 0) /
              desktopResults.length
          )
        : null,
    bestPractices:
      desktopResults.length > 0
        ? Math.round(
            desktopResults.reduce((sum, r) => sum + (r.best_practices_score || 0), 0) /
              desktopResults.length
          )
        : null,
    seo:
      desktopResults.length > 0
        ? Math.round(
            desktopResults.reduce((sum, r) => sum + (r.seo_score || 0), 0) / desktopResults.length
          )
        : null,
  }

  const overallScore = avgMobileScores.performance

  // Extract additional metrics from first mobile result's raw response
  const firstMobileResult = mobileResults[0]
  const additionalMetrics = firstMobileResult?.raw_response
    ? extractAdditionalMetrics(firstMobileResult.raw_response as unknown as PageSpeedResult)
    : { fcp_ms: null, speed_index_ms: null, tti_ms: null, tbt_ms: null, total_byte_weight: null }

  const lcpMs = firstMobileResult?.lcp_ms || null

  // Extract opportunities from first result
  const opportunities = firstMobileResult?.raw_response
    ? extractOpportunities(firstMobileResult.raw_response as unknown as PageSpeedResult)
    : []

  // Dynamic summary text based on scores
  const getSummaryHeadline = () => {
    if (overallScore === null) return 'Unable to analyze website performance.'
    if (overallScore >= 90) return 'Your website is performing excellently!'
    if (overallScore >= 70) return 'Your website has room for improvement.'
    if (overallScore >= 50) return 'Your website performance needs attention.'
    return 'Your website is losing visitors before they even see your content.'
  }

  const getSummaryText = () => {
    if (overallScore === null) return ''
    if (overallScore >= 90) {
      return `Great news! ${clientDomain} loads quickly and provides an excellent user experience. Your site meets Google's Core Web Vitals thresholds, which positively impacts both user satisfaction and search rankings.`
    }
    if (overallScore >= 70) {
      return `Our analysis found that ${clientDomain} has moderate performance. While functional, there are opportunities to improve load times and user experience that could boost engagement and conversions.`
    }
    const loadTime = lcpMs ? `${(lcpMs / 1000).toFixed(1)} seconds` : 'several seconds'
    return `Our analysis found that ${clientDomain} takes over ${loadTime} to fully load on mobile devices. Research shows that 53% of mobile visitors leave a site that takes longer than 3 seconds to load.`
  }

  // Calculate total pages for pagination
  const totalPages = 6 + (urls.length > 1 ? 1 : 0) // Cover + Summary + Business + Metrics + Actions + CTA + (Per-page if multiple)

  return (
    <Document>
      {/* ================================================================== */}
      {/* COVER PAGE */}
      {/* ================================================================== */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.logoContainer}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image doesn't support alt */}
          {logoUri && <Image src={logoUri} style={styles.logo} />}
        </View>

        <Text style={styles.coverTitle}>Website Performance</Text>
        <Text style={styles.coverTitle}>Audit Report</Text>

        <Text style={styles.coverClient}>{clientDomain}</Text>
        <Text style={styles.coverDate}>{reportDate}</Text>

        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>
            {
              "This report analyzes your website's performance, accessibility, and search visibility using Google's PageSpeed Insights methodology."
            }
          </Text>
        </View>
      </Page>

      {/* ================================================================== */}
      {/* EXECUTIVE SUMMARY */}
      {/* ================================================================== */}
      <Page size="A4" style={styles.page}>
        <PageHeader pageNumber={2} totalPages={totalPages} />

        <Text style={styles.sectionTitle}>Executive Summary</Text>

        <View style={styles.executiveSummaryBox}>
          <Text style={styles.summaryHeadline}>{getSummaryHeadline()}</Text>
          <Text style={styles.summaryText}>{getSummaryText()}</Text>
          {overallScore !== null && overallScore < 90 && (
            <Text style={styles.summaryText}>
              {
                "The good news? These issues are fixable. With targeted optimizations, we can significantly improve your site's speed, user experience, and search rankings."
              }
            </Text>
          )}
        </View>

        {/* Overall Score Display */}
        <View style={styles.scoreContainer} wrap={false}>
          <View style={styles.bigScoreBox}>
            <Text style={[styles.bigScoreNumber, { color: getScoreColor(overallScore) }]}>
              {overallScore ?? '—'}
            </Text>
            <Text style={styles.bigScoreLabel}>Overall Performance Score</Text>
            <Text style={styles.scoreDescription}>
              Scores range from 0-100. A score of 90+ is considered good.
              {overallScore !== null &&
                ` Your score of ${overallScore} indicates ${getScoreLabel(overallScore).toLowerCase()} performance.`}
            </Text>
          </View>
        </View>

        {/* Key Findings */}
        <Text style={styles.sectionSubtitle}>Key Findings at a Glance</Text>

        <View style={styles.findingsGrid} wrap={false}>
          <View style={styles.findingCard}>
            <Text style={styles.findingTitle}>Page Load Time (LCP)</Text>
            <Text
              style={[
                styles.findingValue,
                {
                  color: getScoreColor(
                    lcpMs && lcpMs <= 2500 ? 90 : lcpMs && lcpMs <= 4000 ? 60 : 30
                  ),
                },
              ]}
            >
              {formatMs(lcpMs)}
            </Text>
            <Text style={styles.findingDescription}>
              Main content appears in {formatMs(lcpMs)}. Target: under 2.5 seconds.
            </Text>
          </View>

          <View style={styles.findingCard}>
            <Text style={styles.findingTitle}>Page Size</Text>
            <Text
              style={[
                styles.findingValue,
                {
                  color:
                    additionalMetrics.total_byte_weight &&
                    additionalMetrics.total_byte_weight > 3000000
                      ? colors.scorePoor
                      : colors.scoreOkay,
                },
              ]}
            >
              {formatBytes(additionalMetrics.total_byte_weight)}
            </Text>
            <Text style={styles.findingDescription}>
              Total download size. Large pages slow loading, especially on mobile.
            </Text>
          </View>

          <View style={styles.findingCard}>
            <Text style={styles.findingTitle}>Search Visibility (SEO)</Text>
            <Text style={[styles.findingValue, { color: getScoreColor(avgMobileScores.seo) }]}>
              {avgMobileScores.seo ?? '—'}/100
            </Text>
            <Text style={styles.findingDescription}>
              How easily search engines can find and recommend your site.
            </Text>
          </View>

          <View style={styles.findingCard}>
            <Text style={styles.findingTitle}>Best Practices</Text>
            <Text
              style={[styles.findingValue, { color: getScoreColor(avgMobileScores.bestPractices) }]}
            >
              {avgMobileScores.bestPractices ?? '—'}/100
            </Text>
            <Text style={styles.findingDescription}>
              Modern web development standards and security practices.
            </Text>
          </View>
        </View>

        <PageFooter clientDomain={clientDomain} />
      </Page>

      {/* ================================================================== */}
      {/* BUSINESS IMPACT & DETAILED SCORES */}
      {/* ================================================================== */}
      <Page size="A4" style={styles.page}>
        <PageHeader pageNumber={3} totalPages={totalPages} />

        <Text style={styles.sectionTitle}>What This Means for Your Business</Text>

        <Text style={styles.paragraph}>
          {
            "Website performance isn't just a technical concern—it directly impacts your bottom line. Here's how your current scores translate to real business outcomes:"
          }
        </Text>

        {/* Business Impact Stats */}
        <View style={styles.impactBox} wrap={false}>
          <View style={styles.impactStat}>
            <Text style={styles.impactNumber}>53%</Text>
            <Text style={styles.impactLabel}>
              of visitors leave if a page takes {'>'}3s to load
            </Text>
          </View>
          <View style={styles.impactStat}>
            <Text style={styles.impactNumber}>1s</Text>
            <Text style={styles.impactLabel}>delay = 7% drop in conversions</Text>
          </View>
          <View style={styles.impactStat}>
            <Text style={styles.impactNumber}>+25%</Text>
            <Text style={styles.impactLabel}>revenue for every 100ms improvement</Text>
          </View>
        </View>

        {lcpMs && lcpMs > 2500 && (
          <View style={styles.explainerBox}>
            <Text style={styles.explainerTitle}>The Bottom Line</Text>
            <Text style={styles.explainerText}>
              With a {formatMs(lcpMs)} load time, your site may be losing potential customers before
              they even see what you offer.{' '}
              {avgMobileScores.seo &&
                avgMobileScores.seo < 70 &&
                'Combined with low search visibility, this creates a double problem: fewer people find you, and many who do leave before engaging.'}
            </Text>
          </View>
        )}

        {/* Detailed Results Table */}
        <Text style={styles.sectionSubtitle}>Detailed Score Breakdown</Text>

        <View style={styles.table} wrap={false}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: '20%' }]}>DEVICE</Text>
            <Text style={[styles.tableHeaderCell, { width: '20%' }]}>PERFORMANCE</Text>
            <Text style={[styles.tableHeaderCell, { width: '20%' }]}>ACCESSIBILITY</Text>
            <Text style={[styles.tableHeaderCell, { width: '20%' }]}>BEST PRACTICES</Text>
            <Text style={[styles.tableHeaderCell, { width: '20%' }]}>SEO</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellBold, { width: '20%' }]}>Mobile</Text>
            <Text
              style={[
                styles.tableCell,
                { width: '20%', color: getScoreColor(avgMobileScores.performance) },
              ]}
            >
              {avgMobileScores.performance ?? '—'}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: '20%', color: getScoreColor(avgMobileScores.accessibility) },
              ]}
            >
              {avgMobileScores.accessibility ?? '—'}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: '20%', color: getScoreColor(avgMobileScores.bestPractices) },
              ]}
            >
              {avgMobileScores.bestPractices ?? '—'}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: '20%', color: getScoreColor(avgMobileScores.seo) },
              ]}
            >
              {avgMobileScores.seo ?? '—'}
            </Text>
          </View>

          <View style={[styles.tableRow, styles.tableRowAlt]}>
            <Text style={[styles.tableCell, styles.tableCellBold, { width: '20%' }]}>Desktop</Text>
            <Text
              style={[
                styles.tableCell,
                { width: '20%', color: getScoreColor(avgDesktopScores.performance) },
              ]}
            >
              {avgDesktopScores.performance ?? '—'}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: '20%', color: getScoreColor(avgDesktopScores.accessibility) },
              ]}
            >
              {avgDesktopScores.accessibility ?? '—'}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: '20%', color: getScoreColor(avgDesktopScores.bestPractices) },
              ]}
            >
              {avgDesktopScores.bestPractices ?? '—'}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: '20%', color: getScoreColor(avgDesktopScores.seo) },
              ]}
            >
              {avgDesktopScores.seo ?? '—'}
            </Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>Why Mobile Matters Most: </Text>
          Over 60% of web traffic comes from mobile devices. Google uses mobile performance as a
          primary ranking factor, meaning slow mobile speeds hurt both user experience AND your
          search rankings.
        </Text>

        <PageFooter clientDomain={clientDomain} />
      </Page>

      {/* ================================================================== */}
      {/* UNDERSTANDING THE METRICS */}
      {/* ================================================================== */}
      <Page size="A4" style={styles.page}>
        <PageHeader pageNumber={4} totalPages={totalPages} />

        <Text style={styles.sectionTitle}>Understanding the Metrics</Text>

        <Text style={styles.paragraph}>
          {
            "Technical jargon can be confusing. Here's what each metric means for your visitors and your business:"
          }
        </Text>

        <View style={styles.glossaryItem}>
          <Text style={styles.glossaryTerm}>
            Largest Contentful Paint (LCP) — Your Result: {formatMs(lcpMs)}
          </Text>
          <Text style={styles.glossaryDefinition}>
            Measures how long it takes for your main content to appear on screen. This is the moment
            visitors can actually start reading or viewing your page.
          </Text>
          <Text style={styles.glossaryAnalogy}>
            {"Like a store's front door: "}
            {formatMs(lcpMs)}
            {' is '}
            {lcpMs && lcpMs > 2500 ? 'too long—' : ''}
            {'making customers wait '}
            {lcpMs && lcpMs > 2500 ? 'while you slowly open the blinds' : 'just briefly'}
            {'. Target: under 2.5s.'}
          </Text>
        </View>

        <View style={styles.glossaryItem}>
          <Text style={styles.glossaryTerm}>
            First Contentful Paint (FCP) — Your Result: {formatMs(additionalMetrics.fcp_ms)}
          </Text>
          <Text style={styles.glossaryDefinition}>
            The time until visitors see anything at all—even just a loading indicator. This is their
            first visual feedback that your site is working.
          </Text>
          <Text style={styles.glossaryAnalogy}>
            {
              'Like acknowledging a customer when they walk in: a quick "be right with you" builds trust. Target: under 1.8s.'
            }
          </Text>
        </View>

        <View style={styles.glossaryItem}>
          <Text style={styles.glossaryTerm}>
            Speed Index — Your Result: {formatMs(additionalMetrics.speed_index_ms)}
          </Text>
          <Text style={styles.glossaryDefinition}>
            Measures how quickly the visible parts of your page are populated. A lower score means
            content appears faster and more smoothly.
          </Text>
          <Text style={styles.glossaryAnalogy}>
            Think of it as how fast a picture comes into focus. Target: under 3.4s.
          </Text>
        </View>

        <View style={styles.glossaryItem}>
          <Text style={styles.glossaryTerm}>
            Time to Interactive (TTI) — Your Result: {formatMs(additionalMetrics.tti_ms)}
          </Text>
          <Text style={styles.glossaryDefinition}>
            How long before visitors can actually click buttons, fill forms, or interact. Before
            this point, the page may look ready but feels frozen.
          </Text>
          <Text style={styles.glossaryAnalogy}>
            Like a store that looks open but the doors are still locked. Target: under 3.8s.
          </Text>
        </View>

        <View style={styles.glossaryItem}>
          <Text style={styles.glossaryTerm}>
            SEO Score — Your Result: {avgMobileScores.seo ?? '—'}/100
          </Text>
          <Text style={styles.glossaryDefinition}>
            Search Engine Optimization measures how easily Google can find, understand, and
            recommend your site to people searching for what you offer.
          </Text>
          <Text style={styles.glossaryAnalogy}>
            A low score is like having a great store on a hidden side street with no signage.
            Target: 90+.
          </Text>
        </View>

        <PageFooter clientDomain={clientDomain} />
      </Page>

      {/* ================================================================== */}
      {/* RECOMMENDED IMPROVEMENTS */}
      {/* ================================================================== */}
      <Page size="A4" style={styles.page}>
        <PageHeader pageNumber={5} totalPages={totalPages} />

        <Text style={styles.sectionTitle}>Recommended Improvements</Text>

        <Text style={styles.paragraph}>
          Based on our analysis, here are the highest-impact improvements, prioritized by potential
          benefit to your business:
        </Text>

        {opportunities.slice(0, 4).map((opp, index) => {
          const isHighPriority = index < 2
          const cleanDescription = opp.description
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .substring(0, 200)

          return (
            <View key={opp.id} style={styles.actionItem}>
              <Text
                style={
                  isHighPriority
                    ? styles.actionPriority
                    : [styles.actionPriority, styles.actionPriorityMedium]
                }
              >
                {isHighPriority ? 'HIGH PRIORITY' : 'MEDIUM PRIORITY'}
              </Text>
              <Text style={styles.actionTitle}>
                {opp.title} {opp.displayValue && `(${formatSavingsDisplay(opp.displayValue)})`}
              </Text>
              <Text style={styles.actionDescription}>{cleanDescription}</Text>
              <View style={styles.actionImpact}>
                <Text style={styles.actionImpact}>
                  <Text style={styles.actionImpactLabel}>Potential savings: </Text>
                  {opp.displayValue
                    ? formatSavingsDisplay(opp.displayValue)
                    : 'Improved performance'}
                </Text>
              </View>
            </View>
          )
        })}

        {opportunities.length === 0 && (
          <View style={styles.explainerBox}>
            <Text style={styles.explainerTitle}>No Major Issues Found</Text>
            <Text style={styles.explainerText}>
              Your website is well-optimized! Continue monitoring performance to maintain these
              results.
            </Text>
          </View>
        )}

        <PageFooter clientDomain={clientDomain} />
      </Page>

      {/* ================================================================== */}
      {/* PER-PAGE RESULTS (if multiple pages) */}
      {/* ================================================================== */}
      {urls.length > 1 && (
        <Page size="A4" style={styles.page}>
          <PageHeader pageNumber={6} totalPages={totalPages} />

          <Text style={styles.sectionTitle}>Per-Page Results</Text>

          <Text style={styles.paragraph}>Detailed performance scores for each page analyzed:</Text>

          {urls.map((url) => {
            const mobileResult = resultsByUrl[url].mobile
            const desktopResult = resultsByUrl[url].desktop

            return (
              <View key={url} style={styles.pageResultCard}>
                <Text style={styles.pageResultUrl}>{formatUrlDisplay(url)}</Text>
                <View style={styles.pageResultScores}>
                  <View style={styles.pageResultScore}>
                    <Text
                      style={[
                        styles.pageResultScoreValue,
                        { color: getScoreColor(mobileResult?.performance_score || null) },
                      ]}
                    >
                      {mobileResult?.performance_score ?? '—'}
                    </Text>
                    <Text style={styles.pageResultScoreLabel}>Mobile Perf</Text>
                  </View>
                  <View style={styles.pageResultScore}>
                    <Text
                      style={[
                        styles.pageResultScoreValue,
                        { color: getScoreColor(desktopResult?.performance_score || null) },
                      ]}
                    >
                      {desktopResult?.performance_score ?? '—'}
                    </Text>
                    <Text style={styles.pageResultScoreLabel}>Desktop Perf</Text>
                  </View>
                  <View style={styles.pageResultScore}>
                    <Text
                      style={[
                        styles.pageResultScoreValue,
                        { color: getScoreColor(mobileResult?.accessibility_score || null) },
                      ]}
                    >
                      {mobileResult?.accessibility_score ?? '—'}
                    </Text>
                    <Text style={styles.pageResultScoreLabel}>Accessibility</Text>
                  </View>
                  <View style={styles.pageResultScore}>
                    <Text
                      style={[
                        styles.pageResultScoreValue,
                        { color: getScoreColor(mobileResult?.seo_score || null) },
                      ]}
                    >
                      {mobileResult?.seo_score ?? '—'}
                    </Text>
                    <Text style={styles.pageResultScoreLabel}>SEO</Text>
                  </View>
                </View>
              </View>
            )
          })}

          <PageFooter clientDomain={clientDomain} />
        </Page>
      )}

      {/* ================================================================== */}
      {/* NEXT STEPS / CTA */}
      {/* ================================================================== */}
      <Page size="A4" style={styles.page}>
        <PageHeader pageNumber={urls.length > 1 ? 7 : 6} totalPages={totalPages} />

        <Text style={styles.sectionTitle}>Next Steps</Text>

        <Text style={styles.paragraph}>
          This report identifies specific, actionable improvements that can transform your website
          into a fast, engaging experience that converts visitors into customers.
        </Text>

        <Text style={styles.sectionSubtitle}>What We Can Achieve Together</Text>

        <View style={styles.listItem}>
          <Text style={styles.listBullet}>→</Text>
          <Text style={styles.listText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Faster Load Times: </Text>
            Target under 2.5 seconds {lcpMs ? `(currently ${formatMs(lcpMs)})` : ''} to keep
            visitors engaged
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listBullet}>→</Text>
          <Text style={styles.listText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Better Search Rankings: </Text>
            Improve SEO {avgMobileScores.seo ? `from ${avgMobileScores.seo}` : ''} to 90+ so
            customers can find you
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listBullet}>→</Text>
          <Text style={styles.listText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Improved User Experience: </Text>
            Responsive, accessible design that works beautifully on all devices
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listBullet}>→</Text>
          <Text style={styles.listText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Higher Conversions: </Text>
            Faster sites convert better—every second of improvement matters
          </Text>
        </View>

        <View style={styles.explainerBox}>
          <Text style={styles.explainerTitle}>Our Approach</Text>
          <Text style={styles.explainerText}>
            {
              "At Selo Studios, we don't just fix technical issues—we partner with you to understand your business goals and ensure your website actively supports them. We combine data-driven analysis with creative solutions to deliver results that matter to your bottom line."
            }
          </Text>
        </View>

        {/* CTA Box */}
        <View style={styles.ctaBox}>
          <Text style={styles.ctaTitle}>Ready to Improve Your Website Performance?</Text>
          <Text style={styles.ctaText}>
            {
              "Let's discuss how we can implement these improvements and help your website become a powerful tool for your business growth."
            }
          </Text>
          <View style={styles.ctaContact}>
            <View style={styles.ctaContactItem}>
              <Text style={styles.ctaContactLabel}>Email</Text>
              <Text style={styles.ctaContactValue}>hello@selostudios.com</Text>
            </View>
            <View style={styles.ctaContactItem}>
              <Text style={styles.ctaContactLabel}>Website</Text>
              <Text style={styles.ctaContactValue}>selostudios.com</Text>
            </View>
          </View>
        </View>

        <PageFooter clientDomain={clientDomain} />
      </Page>
    </Document>
  )
}

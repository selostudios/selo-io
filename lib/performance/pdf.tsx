import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { PerformanceAudit, PerformanceAuditResult } from './types'
import * as path from 'path'
import * as fs from 'fs'

// Get the logo as a base64 data URI
function getLogoDataUri(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'selo-logo.jpg.webp')
    const logoBuffer = fs.readFileSync(logoPath)
    return `data:image/webp;base64,${logoBuffer.toString('base64')}`
  } catch {
    return ''
  }
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  coverPage: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 40,
  },
  coverContent: {
    marginTop: 160,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 4,
  },
  scoreCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 9,
    color: '#666666',
    textTransform: 'uppercase',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
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
    color: '#666666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricTarget: {
    fontSize: 8,
    color: '#666666',
  },
  metricRating: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  deviceLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 8,
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999999',
    fontSize: 9,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#666666',
    fontSize: 9,
  },
  recommendationsSection: {
    marginTop: 24,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
  },
  recommendationBullet: {
    fontSize: 10,
    marginRight: 8,
    color: '#666666',
  },
  recommendationText: {
    fontSize: 10,
    color: '#333333',
    flex: 1,
    lineHeight: 1.5,
  },
  contactInfo: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 6,
    marginTop: 20,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  contactItem: {
    fontSize: 11,
    color: '#333333',
    marginBottom: 6,
  },
})

interface PerformancePDFProps {
  audit: PerformanceAudit
  results: PerformanceAuditResult[]
}

function getScoreColor(score: number | null): string {
  if (score === null) return '#999999'
  if (score >= 90) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function getRatingStyle(rating: string | null) {
  switch (rating) {
    case 'good':
      return styles.metricCardGood
    case 'needs_improvement':
      return styles.metricCardNeedsImprovement
    case 'poor':
      return styles.metricCardPoor
    default:
      return styles.metricCardNoData
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
      return '#666666'
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
  return (
    <View style={styles.metricsRow}>
      <View style={[styles.metricCard, getRatingStyle(result.lcp_rating)]}>
        <Text style={styles.metricName}>LCP (Largest Contentful Paint)</Text>
        <Text style={[styles.metricValue, { color: getRatingColor(result.lcp_rating) }]}>
          {formatLCP(result.lcp_ms)}
        </Text>
        <Text style={styles.metricTarget}>Target: {'<'} 2.5s</Text>
        <Text style={[styles.metricRating, { color: getRatingColor(result.lcp_rating) }]}>
          {getRatingLabel(result.lcp_rating)}
        </Text>
      </View>
      <View style={[styles.metricCard, getRatingStyle(result.inp_rating)]}>
        <Text style={styles.metricName}>INP (Interaction to Next Paint)</Text>
        <Text style={[styles.metricValue, { color: getRatingColor(result.inp_rating) }]}>
          {formatINP(result.inp_ms)}
        </Text>
        <Text style={styles.metricTarget}>Target: {'<'} 200ms</Text>
        <Text style={[styles.metricRating, { color: getRatingColor(result.inp_rating) }]}>
          {getRatingLabel(result.inp_rating)}
        </Text>
      </View>
      <View style={[styles.metricCard, getRatingStyle(result.cls_rating)]}>
        <Text style={styles.metricName}>CLS (Cumulative Layout Shift)</Text>
        <Text style={[styles.metricValue, { color: getRatingColor(result.cls_rating) }]}>
          {formatCLS(result.cls_score)}
        </Text>
        <Text style={styles.metricTarget}>Target: {'<'} 0.1</Text>
        <Text style={[styles.metricRating, { color: getRatingColor(result.cls_rating) }]}>
          {getRatingLabel(result.cls_rating)}
        </Text>
      </View>
    </View>
  )
}

function LighthouseScoresSection({ result }: { result: PerformanceAuditResult }) {
  return (
    <View style={styles.scoreCardsRow}>
      <View style={styles.scoreCard}>
        <Text style={[styles.scoreValue, { color: getScoreColor(result.performance_score) }]}>
          {result.performance_score ?? '—'}
        </Text>
        <Text style={styles.scoreLabel}>Performance</Text>
      </View>
      <View style={styles.scoreCard}>
        <Text style={[styles.scoreValue, { color: getScoreColor(result.accessibility_score) }]}>
          {result.accessibility_score ?? '—'}
        </Text>
        <Text style={styles.scoreLabel}>Accessibility</Text>
      </View>
      <View style={styles.scoreCard}>
        <Text style={[styles.scoreValue, { color: getScoreColor(result.best_practices_score) }]}>
          {result.best_practices_score ?? '—'}
        </Text>
        <Text style={styles.scoreLabel}>Best Practices</Text>
      </View>
      <View style={styles.scoreCard}>
        <Text style={[styles.scoreValue, { color: getScoreColor(result.seo_score) }]}>
          {result.seo_score ?? '—'}
        </Text>
        <Text style={styles.scoreLabel}>SEO</Text>
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
    <View style={styles.section}>
      <Text style={styles.pageTitle}>{getPathname(url)}</Text>

      {mobileResult && (
        <>
          <Text style={styles.deviceLabel}>📱 Mobile</Text>
          <LighthouseScoresSection result={mobileResult} />
          <CoreWebVitalsSection result={mobileResult} />
        </>
      )}

      {desktopResult && (
        <>
          <Text style={styles.deviceLabel}>🖥️ Desktop</Text>
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
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverContent}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image doesn't support alt */}
          {logoUri && <Image src={logoUri} style={styles.logo} />}
          <Text style={styles.title}>Performance Audit Report</Text>
          <Text style={styles.subtitle}>{urls.length} pages analyzed</Text>
          <Text style={styles.subtitle}>{reportDate}</Text>
        </View>
        <Text style={styles.coverFooter}>Generated by Selo Studios</Text>
      </Page>

      {/* Summary Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Executive Summary</Text>

        <View style={styles.scoreCardsRow}>
          <View style={styles.scoreCard}>
            <Text style={[styles.scoreValue, { color: getScoreColor(avgPerformance) }]}>
              {avgPerformance ?? '—'}
            </Text>
            <Text style={styles.scoreLabel}>Avg Performance</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{urls.length}</Text>
            <Text style={styles.scoreLabel}>Pages Tested</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{results.length}</Text>
            <Text style={styles.scoreLabel}>Total Tests</Text>
          </View>
        </View>

        <View style={styles.recommendationsSection}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
            Understanding Your Scores
          </Text>

          <View style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>•</Text>
            <Text style={styles.recommendationText}>
              <Text style={{ fontWeight: 'bold' }}>Performance (0-100):</Text> Measures how fast
              your page loads and becomes interactive. Aim for 90+.
            </Text>
          </View>

          <View style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>•</Text>
            <Text style={styles.recommendationText}>
              <Text style={{ fontWeight: 'bold' }}>LCP (Largest Contentful Paint):</Text> Time until
              the main content is visible. Should be under 2.5 seconds.
            </Text>
          </View>

          <View style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>•</Text>
            <Text style={styles.recommendationText}>
              <Text style={{ fontWeight: 'bold' }}>INP (Interaction to Next Paint):</Text> How
              quickly the page responds to user interactions. Should be under 200ms.
            </Text>
          </View>

          <View style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>•</Text>
            <Text style={styles.recommendationText}>
              <Text style={{ fontWeight: 'bold' }}>CLS (Cumulative Layout Shift):</Text> Visual
              stability - how much content shifts unexpectedly. Should be under 0.1.
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>Performance Audit Report - Page 2</Text>
      </Page>

      {/* Results Pages */}
      {urls.map((url, index) => (
        <Page key={url} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Page Results</Text>

          <PageResultSection
            url={url}
            mobileResult={resultsByUrl[url].mobile}
            desktopResult={resultsByUrl[url].desktop}
          />

          <Text style={styles.footer}>Performance Audit Report - Page {index + 3}</Text>
        </Page>
      ))}

      {/* Next Steps */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Next Steps</Text>

        <View style={styles.recommendationsSection}>
          <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#333333', marginBottom: 16 }}>
            Based on your performance audit results, here are recommended actions to improve your
            website speed and user experience:
          </Text>

          <View style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>1.</Text>
            <Text style={styles.recommendationText}>
              Optimize images by using modern formats (WebP, AVIF) and implementing lazy loading.
            </Text>
          </View>

          <View style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>2.</Text>
            <Text style={styles.recommendationText}>
              Minimize JavaScript and CSS by removing unused code and deferring non-critical
              scripts.
            </Text>
          </View>

          <View style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>3.</Text>
            <Text style={styles.recommendationText}>
              Implement caching strategies for static assets to reduce server load and improve load
              times.
            </Text>
          </View>

          <View style={styles.recommendationItem}>
            <Text style={styles.recommendationBullet}>4.</Text>
            <Text style={styles.recommendationText}>
              Consider using a CDN to serve content from locations closer to your users.
            </Text>
          </View>

          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Need Help Improving Performance?</Text>
            <Text style={styles.contactItem}>Email: hello@selostudios.com</Text>
            <Text style={styles.contactItem}>Website: selostudios.com</Text>
          </View>
        </View>

        <Text style={styles.footer}>Performance Audit Report</Text>
      </Page>
    </Document>
  )
}

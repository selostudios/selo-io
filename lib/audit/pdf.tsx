import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { SiteAudit, SiteAuditCheck } from './types'
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
  summaryText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#333333',
    marginBottom: 16,
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
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 10,
    color: '#666666',
  },
  checkTypeHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    marginTop: 16,
    backgroundColor: '#f9f9f9',
    padding: 8,
    borderRadius: 4,
  },
  checkItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkStatus: {
    width: 24,
    fontSize: 12,
  },
  checkStatusPassed: {
    color: '#22c55e',
  },
  checkStatusFailed: {
    color: '#ef4444',
  },
  checkStatusWarning: {
    color: '#f59e0b',
  },
  checkContent: {
    flex: 1,
  },
  checkName: {
    fontSize: 11,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  checkPriority: {
    fontSize: 9,
    color: '#666666',
    textTransform: 'uppercase',
  },
  priorityCritical: {
    color: '#ef4444',
  },
  priorityRecommended: {
    color: '#f59e0b',
  },
  priorityOptional: {
    color: '#6b7280',
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
  nextStepsSection: {
    marginTop: 40,
  },
  nextStepsText: {
    fontSize: 12,
    lineHeight: 1.6,
    color: '#333333',
    marginBottom: 24,
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
  noChecks: {
    fontSize: 11,
    color: '#666666',
    fontStyle: 'italic',
    padding: 10,
  },
})

interface AuditPDFProps {
  audit: SiteAudit
  checks: SiteAuditCheck[]
}

function formatCheckName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getScoreColor(score: number | null): string {
  if (score === null) return '#999999'
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

function CheckStatusIcon({ status }: { status: string }) {
  const style =
    status === 'passed'
      ? styles.checkStatusPassed
      : status === 'warning'
        ? styles.checkStatusWarning
        : styles.checkStatusFailed

  const symbol = status === 'passed' ? 'PASS' : status === 'warning' ? 'WARN' : 'FAIL'

  return <Text style={[styles.checkStatus, style]}>{symbol}</Text>
}

function PriorityBadge({ priority }: { priority: string }) {
  const priorityStyle =
    priority === 'critical'
      ? styles.priorityCritical
      : priority === 'recommended'
        ? styles.priorityRecommended
        : styles.priorityOptional

  return <Text style={[styles.checkPriority, priorityStyle]}>{priority}</Text>
}

function CheckListSection({ title, checks }: { title: string; checks: SiteAuditCheck[] }) {
  const failedChecks = checks.filter((c) => c.status !== 'passed')
  const passedChecks = checks.filter((c) => c.status === 'passed')

  if (checks.length === 0) {
    return null
  }

  return (
    <View style={styles.section}>
      <Text style={styles.checkTypeHeader}>
        {title} ({failedChecks.length} issues, {passedChecks.length} passed)
      </Text>
      {failedChecks.map((check) => (
        <View key={check.id} style={styles.checkItem}>
          <CheckStatusIcon status={check.status} />
          <View style={styles.checkContent}>
            <Text style={styles.checkName}>{formatCheckName(check.check_name)}</Text>
            <PriorityBadge priority={check.priority} />
          </View>
        </View>
      ))}
      {passedChecks.map((check) => (
        <View key={check.id} style={styles.checkItem}>
          <CheckStatusIcon status={check.status} />
          <View style={styles.checkContent}>
            <Text style={styles.checkName}>{formatCheckName(check.check_name)}</Text>
            <PriorityBadge priority={check.priority} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function AuditPDF({ audit, checks }: AuditPDFProps) {
  const seoChecks = checks.filter((c) => c.check_type === 'seo')
  const aiChecks = checks.filter((c) => c.check_type === 'ai_readiness')
  const techChecks = checks.filter((c) => c.check_type === 'technical')

  const logoUri = getLogoDataUri()
  const displayUrl = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const reportDate = new Date(audit.completed_at || audit.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const criticalIssues = checks.filter(
    (c) => c.priority === 'critical' && c.status === 'failed'
  ).length
  const totalIssues = checks.filter((c) => c.status !== 'passed').length
  const passedChecks = checks.filter((c) => c.status === 'passed').length

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverContent}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image doesn't support alt */}
          {logoUri && <Image src={logoUri} style={styles.logo} />}
          <Text style={styles.title}>Website Audit Report</Text>
          <Text style={styles.subtitle}>{displayUrl}</Text>
          <Text style={styles.subtitle}>{reportDate}</Text>
        </View>
        <Text style={styles.coverFooter}>Generated by Selo Studios</Text>
      </Page>

      {/* Executive Summary & Scores */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Executive Summary</Text>

        {audit.executive_summary && (
          <Text style={styles.summaryText}>{audit.executive_summary}</Text>
        )}

        {/* Score Cards */}
        <View style={styles.scoreCardsRow}>
          <View style={styles.scoreCard}>
            <Text style={[styles.scoreValue, { color: getScoreColor(audit.overall_score) }]}>
              {audit.overall_score ?? '-'}
            </Text>
            <Text style={styles.scoreLabel}>Overall Score</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={[styles.scoreValue, { color: getScoreColor(audit.seo_score) }]}>
              {audit.seo_score ?? '-'}
            </Text>
            <Text style={styles.scoreLabel}>SEO Score</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={[styles.scoreValue, { color: getScoreColor(audit.ai_readiness_score) }]}>
              {audit.ai_readiness_score ?? '-'}
            </Text>
            <Text style={styles.scoreLabel}>AI Readiness</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={[styles.scoreValue, { color: getScoreColor(audit.technical_score) }]}>
              {audit.technical_score ?? '-'}
            </Text>
            <Text style={styles.scoreLabel}>Technical</Text>
          </View>
        </View>

        {/* Key Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{audit.pages_crawled}</Text>
            <Text style={styles.statLabel}>Pages Crawled</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{criticalIssues}</Text>
            <Text style={styles.statLabel}>Critical Issues</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{totalIssues}</Text>
            <Text style={styles.statLabel}>Total Issues</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>{passedChecks}</Text>
            <Text style={styles.statLabel}>Checks Passed</Text>
          </View>
        </View>

        <Text style={styles.footer}>{displayUrl} - Audit Report - Page 2</Text>
      </Page>

      {/* Detailed Findings */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Detailed Findings</Text>

        <CheckListSection title="SEO Issues" checks={seoChecks} />
        <CheckListSection title="AI-Readiness Issues" checks={aiChecks} />
        <CheckListSection title="Technical Issues" checks={techChecks} />

        {checks.length === 0 && (
          <Text style={styles.noChecks}>No checks have been performed yet.</Text>
        )}

        <Text style={styles.footer}>{displayUrl} - Audit Report - Page 3</Text>
      </Page>

      {/* Next Steps */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Next Steps</Text>

        <View style={styles.nextStepsSection}>
          <Text style={styles.nextStepsText}>
            Thank you for using Selo Studios website audit service. Based on the findings in this
            report, we recommend addressing the critical issues first, followed by recommended
            improvements.
          </Text>

          <Text style={styles.nextStepsText}>
            Our team can help you implement these changes and improve your website&apos;s SEO
            performance, AI-readiness, and technical health. Contact us to discuss your audit
            results and create a customized action plan.
          </Text>

          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Get in Touch</Text>
            <Text style={styles.contactItem}>Email: hello@selostudios.com</Text>
            <Text style={styles.contactItem}>Website: selostudios.com</Text>
          </View>
        </View>

        <Text style={styles.footer}>{displayUrl} - Audit Report - Page 4</Text>
      </Page>
    </Document>
  )
}

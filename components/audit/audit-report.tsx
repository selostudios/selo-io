'use client'

import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScoreCards } from './score-cards'
import { CheckList } from './check-list'
import type { SiteAudit, SiteAuditCheck, SiteAuditPage } from '@/lib/audit/types'
import { formatDate } from '@/lib/utils'
import { useState } from 'react'

interface AuditReportProps {
  audit: SiteAudit
  checks: SiteAuditCheck[]
  pages: SiteAuditPage[]
}

type PriorityFilter = 'all' | 'critical' | 'recommended' | 'optional' | 'passed'

export function AuditReport({ audit, checks }: AuditReportProps) {
  const [activeFilter, setActiveFilter] = useState<PriorityFilter>('all')

  // Group checks by type
  const seoChecks = checks.filter((c) => c.check_type === 'seo')
  const aiChecks = checks.filter((c) => c.check_type === 'ai_readiness')
  const technicalChecks = checks.filter((c) => c.check_type === 'technical')

  // Count by priority/status
  const criticalCount = checks.filter(
    (c) => c.priority === 'critical' && c.status === 'failed'
  ).length
  const recommendedCount = checks.filter(
    (c) => c.priority === 'recommended' && c.status === 'failed'
  ).length
  const optionalCount = checks.filter(
    (c) => c.priority === 'optional' && c.status === 'failed'
  ).length
  const passedCount = checks.filter((c) => c.status === 'passed').length

  // Filter checks based on active filter
  const filterChecks = (checkList: SiteAuditCheck[]) => {
    if (activeFilter === 'all') return checkList
    if (activeFilter === 'passed') return checkList.filter((c) => c.status === 'passed')
    return checkList.filter((c) => c.priority === activeFilter && c.status === 'failed')
  }

  // Extract domain from URL for display
  const displayUrl = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Audits
        </Link>
        <Button variant="outline" asChild>
          <a href={`/api/audit/${audit.id}/export`} download>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </a>
        </Button>
      </div>

      {/* Site Info */}
      <div>
        <h1 className="text-2xl font-bold">{displayUrl}</h1>
        <p className="text-muted-foreground text-sm">
          Audited {audit.completed_at ? formatDate(audit.completed_at, false) : 'In progress'}{' '}
          &middot; {audit.pages_crawled} page{audit.pages_crawled !== 1 ? 's' : ''} crawled
        </p>
      </div>

      {/* Executive Summary */}
      {audit.executive_summary && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-lg font-semibold">Executive Summary</h2>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
              {audit.executive_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Score Cards */}
      <ScoreCards
        overall={audit.overall_score}
        seo={audit.seo_score}
        ai={audit.ai_readiness_score}
        technical={audit.technical_score}
      />

      {/* Priority Filter Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={activeFilter === 'all' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setActiveFilter('all')}
        >
          All ({checks.length})
        </Badge>
        <Badge
          variant={activeFilter === 'critical' ? 'destructive' : 'outline'}
          className="cursor-pointer"
          onClick={() => setActiveFilter('critical')}
        >
          Critical ({criticalCount})
        </Badge>
        <Badge
          variant={activeFilter === 'recommended' ? 'warning' : 'outline'}
          className="cursor-pointer"
          onClick={() => setActiveFilter('recommended')}
        >
          Recommended ({recommendedCount})
        </Badge>
        <Badge
          variant={activeFilter === 'optional' ? 'secondary' : 'outline'}
          className="cursor-pointer"
          onClick={() => setActiveFilter('optional')}
        >
          Optional ({optionalCount})
        </Badge>
        <Badge
          variant={activeFilter === 'passed' ? 'success' : 'outline'}
          className="cursor-pointer"
          onClick={() => setActiveFilter('passed')}
        >
          Passed ({passedCount})
        </Badge>
      </div>

      {/* Check Lists */}
      <div className="space-y-4">
        <CheckList title="SEO Issues" checks={filterChecks(seoChecks)} />
        <CheckList title="AI-Readiness Issues" checks={filterChecks(aiChecks)} />
        <CheckList title="Technical Issues" checks={filterChecks(technicalChecks)} />
      </div>
    </div>
  )
}

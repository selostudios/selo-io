'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScoreTrendChart } from './score-trend-chart'
import { AuditHistoryList } from './audit-history-list'
import { DismissedChecksList } from './dismissed-checks-list'
import type { SiteAudit } from '@/lib/audit/types'

interface AuditDashboardProps {
  websiteUrl: string
  audits: SiteAudit[]
  archivedAudits: SiteAudit[]
  projectId?: string
}

export function AuditDashboard({ websiteUrl, audits, archivedAudits, projectId }: AuditDashboardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRunAudit = () => {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/audit/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to start audit')
          return
        }

        const data = await response.json()
        router.push(`/seo/site-audit/${data.auditId}`)
      } catch (err) {
        console.error('[Audit Dashboard] Failed to start audit:', err)
        setError('Failed to start audit')
      }
    })
  }

  // Group archived audits by domain
  const archivedByDomain = archivedAudits.reduce(
    (acc, audit) => {
      const domain = new URL(audit.url).hostname
      if (!acc[domain]) {
        acc[domain] = []
      }
      acc[domain].push(audit)
      return acc
    },
    {} as Record<string, SiteAudit[]>
  )

  return (
    <div className="space-y-6">
      {/* Website URL Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{websiteUrl}</CardTitle>
              <CardDescription>Organization URL</CardDescription>
            </div>
            <Button onClick={handleRunAudit} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Run New Audit'
              )}
            </Button>
          </div>
          {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
        </CardHeader>
      </Card>

      {/* Score History */}
      {audits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart audits={audits} />
          </CardContent>
        </Card>
      )}

      {/* Audit History */}
      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditHistoryList audits={audits} />
        </CardContent>
      </Card>

      {/* Dismissed Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Dismissed Checks</CardTitle>
          <CardDescription>
            Checks you&apos;ve marked as not applicable. These will be hidden in future audits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DismissedChecksList />
        </CardContent>
      </Card>

      {/* Archived Audits */}
      {Object.keys(archivedByDomain).length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 py-2 text-left text-sm font-medium"
          >
            {showArchived ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Previous domain (archived)
          </button>
          {showArchived && (
            <div className="space-y-4 pt-2">
              {Object.entries(archivedByDomain).map(([domain, domainAudits]) => (
                <Card key={domain}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{domain}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AuditHistoryList audits={domainAudits} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

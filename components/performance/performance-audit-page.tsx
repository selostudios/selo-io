'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, Smartphone, Monitor } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PerformanceResults } from './performance-results'
import { formatDate, formatDuration, calculateDuration } from '@/lib/utils'
import type { PerformanceAudit, PerformanceAuditResult, DeviceType } from '@/lib/performance/types'

interface PerformanceAuditPageProps {
  id: string
  audit: PerformanceAudit
  results: PerformanceAuditResult[]
}

export function PerformanceAuditPage({ id, audit, results }: PerformanceAuditPageProps) {
  const [device, setDevice] = useState<DeviceType>('mobile')

  // Extract domain from first URL
  const firstUrl = audit.first_url || audit.current_url || results[0]?.url
  const displayUrl = firstUrl
    ? firstUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : 'Unknown'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/seo/page-speed"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Page Speed
        </Link>
        {audit.status === 'completed' && (
          <Button variant="outline" asChild>
            <a href={`/api/performance/${id}/export`} download>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </a>
          </Button>
        )}
      </div>

      {/* Audit Info with Device Toggle */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">PageSpeed Audit:</h1>
            {firstUrl && (
              <a
                href={firstUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl font-bold hover:underline inline-flex items-center gap-1.5"
              >
                {displayUrl}
                <ExternalLink className="size-5 text-muted-foreground" />
              </a>
            )}
            <Badge
              variant={
                audit.status === 'completed'
                  ? 'success'
                  : audit.status === 'failed'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {audit.status}
            </Badge>
          </div>
          <Tabs
            value={device}
            onValueChange={(v) => setDevice(v as DeviceType)}
            aria-label="Select device type"
          >
            <TabsList>
              <TabsTrigger value="mobile" className="gap-2">
                <Smartphone className="size-4" />
                Mobile
              </TabsTrigger>
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="size-4" />
                Desktop
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-muted-foreground text-sm">
          {audit.status === 'failed' ? 'Failed' : 'Audited'}{' '}
          {audit.completed_at ? formatDate(audit.completed_at, false) : 'In progress'} &middot;{' '}
          {audit.total_urls} page{audit.total_urls !== 1 ? 's' : ''} tested
          {(() => {
            const duration = calculateDuration(audit.started_at, audit.completed_at)
            return duration ? ` · ${formatDuration(duration)}` : ''
          })()}
        </p>
        {audit.error_message && (
          <p className="mt-2 text-sm text-red-600">{audit.error_message}</p>
        )}
      </div>

      {/* Results */}
      <PerformanceResults results={results} device={device} />
    </div>
  )
}

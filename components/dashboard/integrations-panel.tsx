'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LinkedInSection } from './linkedin-section'
import { GoogleAnalyticsSection } from './google-analytics-section'
import { HubSpotSection } from './hubspot-section'
import { syncLinkedInMetrics } from '@/lib/platforms/linkedin/actions'
import { syncGoogleAnalyticsMetrics } from '@/lib/platforms/google-analytics/actions'
import { syncHubSpotMetrics } from '@/lib/platforms/hubspot/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

export type Period = '7d' | '30d' | 'quarter'

interface IntegrationsPanelProps {
  linkedIn: { isConnected: boolean; lastSyncAt: string | null }
  googleAnalytics: { isConnected: boolean; lastSyncAt: string | null }
  hubspot: { isConnected: boolean; lastSyncAt: string | null }
  connectionCount: number
  totalPlatforms: number
}

function getMostRecentSync(...syncTimes: (string | null)[]): string | null {
  const validTimes = syncTimes.filter((t): t is string => t !== null)
  if (validTimes.length === 0) return null
  return validTimes.reduce((latest, current) =>
    new Date(current) > new Date(latest) ? current : latest
  )
}

export function IntegrationsPanel({
  linkedIn,
  googleAnalytics,
  hubspot,
  connectionCount,
  totalPlatforms,
}: IntegrationsPanelProps) {
  const [period, setPeriod] = useState<Period>('7d')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    getMostRecentSync(linkedIn.lastSyncAt, googleAnalytics.lastSyncAt, hubspot.lastSyncAt)
  )

  async function handleRefreshAll() {
    setIsRefreshing(true)

    const results = await Promise.allSettled([
      linkedIn.isConnected ? syncLinkedInMetrics() : Promise.resolve({ skipped: true }),
      googleAnalytics.isConnected
        ? syncGoogleAnalyticsMetrics()
        : Promise.resolve({ skipped: true }),
      hubspot.isConnected ? syncHubSpotMetrics() : Promise.resolve({ skipped: true }),
    ])

    const errors: string[] = []
    let successCount = 0

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const value = result.value as { error?: string; skipped?: boolean }
        if (value.skipped) return
        if (value.error) {
          errors.push(value.error)
        } else {
          successCount++
        }
      } else {
        errors.push(result.reason?.message || 'Unknown error')
      }
    })

    if (errors.length > 0) {
      showError(`Some syncs failed: ${errors.join(', ')}`)
    }
    if (successCount > 0) {
      showSuccess(`${successCount} integration${successCount > 1 ? 's' : ''} synced`)
    }

    setRefreshKey((k) => k + 1)
    setLastSyncAt(new Date().toISOString())
    setIsRefreshing(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Integrations</h2>
            <span className="text-muted-foreground text-base font-semibold">
              {connectionCount}/{totalPlatforms}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Last synced: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[130px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="quarter">This quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefreshAll} disabled={isRefreshing}>
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="sr-only">Refresh All</span>
          </Button>
          <Button variant="outline" size="default" asChild>
            <Link href="/settings/integrations">Manage</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <LinkedInSection
          key={`linkedin-${refreshKey}`}
          isConnected={linkedIn.isConnected}
          period={period}
        />
        <GoogleAnalyticsSection
          key={`ga-${refreshKey}`}
          isConnected={googleAnalytics.isConnected}
          period={period}
        />
        <HubSpotSection
          key={`hubspot-${refreshKey}`}
          isConnected={hubspot.isConnected}
          period={period}
        />
      </div>
    </div>
  )
}

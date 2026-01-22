'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MetricCard } from './metric-card'
import { getGoogleAnalyticsMetrics } from '@/lib/platforms/google-analytics/actions'
import type { TrafficAcquisition } from '@/lib/platforms/google-analytics/types'
import type { Period } from './integrations-panel'

interface GAMetrics {
  activeUsers: number
  newUsers: number
  sessions: number
  trafficAcquisition: TrafficAcquisition
}

interface GoogleAnalyticsSectionProps {
  isConnected: boolean
  period: Period
}

export function GoogleAnalyticsSection({ isConnected, period }: GoogleAnalyticsSectionProps) {
  const [metrics, setMetrics] = useState<GAMetrics | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (isConnected) {
      startTransition(async () => {
        const result = await getGoogleAnalyticsMetrics(period)
        if (result.metrics) {
          setMetrics(result.metrics)
        }
      })
    }
  }, [isConnected, period])

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Google Analytics</CardTitle>
              <CardDescription>
                Connect Google Analytics to view website traffic metrics.
              </CardDescription>
            </div>
            <Button asChild size="sm">
              <Link href="/settings/integrations">Connect</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Analytics</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[200px]">
        {isPending ? (
          <div className="flex h-[180px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : metrics ? (
          <div className="space-y-6">
            {/* Main metrics */}
            <div className="grid grid-cols-3 gap-4">
              <MetricCard label="Active Users" value={metrics.activeUsers} change={null} />
              <MetricCard label="New Users" value={metrics.newUsers} change={null} />
              <MetricCard label="Sessions" value={metrics.sessions} change={null} />
            </div>

            {/* Traffic Acquisition */}
            <div>
              <h4 className="mb-4 text-sm font-medium">Traffic Acquisition</h4>
              <div className="flex flex-row justify-between">
                <div className="flex-1">
                  <p className="text-2xl font-bold">{metrics.trafficAcquisition.direct}</p>
                  <p className="text-muted-foreground text-xs">Direct</p>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{metrics.trafficAcquisition.organicSearch}</p>
                  <p className="text-muted-foreground text-xs">Organic Search</p>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{metrics.trafficAcquisition.email}</p>
                  <p className="text-muted-foreground text-xs">Email</p>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{metrics.trafficAcquisition.organicSocial}</p>
                  <p className="text-muted-foreground text-xs">Organic Social</p>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{metrics.trafficAcquisition.referral}</p>
                  <p className="text-muted-foreground text-xs">Referral</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
        )}
      </CardContent>
    </Card>
  )
}

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
              <CardDescription className="mt-1">
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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Google Analytics</h3>
      {isPending ? (
        <div className="flex h-[100px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Main metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Active Users" value={metrics.activeUsers} change={null} />
            <MetricCard label="New Users" value={metrics.newUsers} change={null} />
            <MetricCard label="Sessions" value={metrics.sessions} change={null} />
          </div>

          {/* Traffic Acquisition */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Traffic Acquisition</h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <MetricCard label="Direct" value={metrics.trafficAcquisition.direct} change={null} />
              <MetricCard
                label="Organic Search"
                value={metrics.trafficAcquisition.organicSearch}
                change={null}
              />
              <MetricCard label="Email" value={metrics.trafficAcquisition.email} change={null} />
              <MetricCard
                label="Organic Social"
                value={metrics.trafficAcquisition.organicSocial}
                change={null}
              />
              <MetricCard
                label="Referral"
                value={metrics.trafficAcquisition.referral}
                change={null}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
      )}
    </div>
  )
}

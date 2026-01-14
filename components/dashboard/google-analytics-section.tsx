'use client'

import { useState, useEffect, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MetricCard } from './metric-card'
import {
  syncGoogleAnalyticsMetrics,
  getGoogleAnalyticsMetrics,
} from '@/lib/platforms/google-analytics/actions'
import { showSuccess, showError } from '@/components/ui/sonner'
import type { TrafficAcquisition } from '@/lib/platforms/google-analytics/types'

type Period = '7d' | '30d' | 'quarter'

interface GAMetrics {
  activeUsers: number
  newUsers: number
  sessions: number
  trafficAcquisition: TrafficAcquisition
}

interface GoogleAnalyticsSectionProps {
  isConnected: boolean
  lastSyncAt: string | null
}

export function GoogleAnalyticsSection({
  isConnected,
  lastSyncAt,
}: GoogleAnalyticsSectionProps) {
  const [period, setPeriod] = useState<Period>('7d')
  const [metrics, setMetrics] = useState<GAMetrics | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  async function loadMetrics() {
    startTransition(async () => {
      const result = await getGoogleAnalyticsMetrics(period)
      if (result.metrics) {
        setMetrics(result.metrics)
      }
    })
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    const result = await syncGoogleAnalyticsMetrics()

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('Google Analytics metrics updated')
      await loadMetrics()
    }
    setIsRefreshing(false)
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Connect Google Analytics in Settings to view metrics.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Google Analytics</CardTitle>
            {lastSyncAt && (
              <p className="text-muted-foreground mt-1 text-xs">
                Last synced: {new Date(lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-muted-foreground">Loading metrics...</p>
        ) : metrics ? (
          <div className="space-y-6">
            {/* Main metrics */}
            <div className="grid grid-cols-3 gap-4">
              <MetricCard
                label="Active Users"
                value={metrics.activeUsers}
                change={null}
              />
              <MetricCard
                label="New Users"
                value={metrics.newUsers}
                change={null}
              />
              <MetricCard
                label="Sessions"
                value={metrics.sessions}
                change={null}
              />
            </div>

            {/* Traffic Acquisition */}
            <div>
              <h4 className="text-sm font-medium mb-3">Traffic Acquisition</h4>
              <div className="flex justify-between">
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

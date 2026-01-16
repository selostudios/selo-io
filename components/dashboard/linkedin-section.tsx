'use client'

import { useState, useEffect, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import Link from 'next/link'
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
import { syncLinkedInMetrics, getLinkedInMetrics } from '@/lib/platforms/linkedin/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

type Period = '7d' | '30d' | 'quarter'

interface Metric {
  label: string
  value: number
  change: number | null
}

interface LinkedInSectionProps {
  isConnected: boolean
  lastSyncAt: string | null
}

export function LinkedInSection({ isConnected, lastSyncAt }: LinkedInSectionProps) {
  const [period, setPeriod] = useState<Period>('7d')
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (isConnected) {
      startTransition(async () => {
        const result = await getLinkedInMetrics(period)
        if (result.metrics) {
          setMetrics(result.metrics)
        }
      })
    }
  }, [isConnected, period])

  async function loadMetrics() {
    startTransition(async () => {
      const result = await getLinkedInMetrics(period)
      if (result.metrics) {
        setMetrics(result.metrics)
      }
    })
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    const result = await syncLinkedInMetrics()

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('LinkedIn metrics updated')
      await loadMetrics()
    }
    setIsRefreshing(false)
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>LinkedIn</CardTitle>
            <Button asChild size="sm">
              <Link href="/settings/integrations">Configure</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Connect LinkedIn to view engagement metrics.
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
            <CardTitle>LinkedIn</CardTitle>
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
        ) : metrics.length > 0 ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                change={metric.change}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
        )}
      </CardContent>
    </Card>
  )
}

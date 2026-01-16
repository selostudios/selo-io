'use client'

import { useState, useEffect, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MetricCard } from './metric-card'
import { syncHubSpotMetrics, getHubSpotMetrics } from '@/lib/platforms/hubspot/actions'
import { showSuccess, showError } from '@/components/ui/sonner'
import type { HubSpotMetrics } from '@/lib/platforms/hubspot/types'

interface HubSpotSectionProps {
  isConnected: boolean
  lastSyncAt: string | null
}

export function HubSpotSection({ isConnected, lastSyncAt }: HubSpotSectionProps) {
  const [metrics, setMetrics] = useState<HubSpotMetrics | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (isConnected) {
      startTransition(async () => {
        const result = await getHubSpotMetrics()
        if (result.metrics) {
          setMetrics(result.metrics)
        }
      })
    }
  }, [isConnected])

  async function loadMetrics() {
    startTransition(async () => {
      const result = await getHubSpotMetrics()
      if (result.metrics) {
        setMetrics(result.metrics)
      }
    })
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    const result = await syncHubSpotMetrics()

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('HubSpot metrics updated')
      await loadMetrics()
    }
    setIsRefreshing(false)
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>HubSpot</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Connect HubSpot to view CRM and marketing metrics.
          </p>
          <Button asChild>
            <Link href="/settings/integrations">Configure</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>HubSpot</CardTitle>
            {lastSyncAt && (
              <p className="text-muted-foreground mt-1 text-xs">
                Last synced: {new Date(lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>
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
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-muted-foreground">Loading metrics...</p>
        ) : metrics ? (
          <div className="space-y-6">
            {/* CRM Metrics */}
            <div>
              <h4 className="mb-4 text-sm font-medium">CRM</h4>
              <div className="grid grid-cols-3 gap-4">
                <MetricCard label="Total Contacts" value={metrics.crm.totalContacts} change={null} />
                <MetricCard label="Total Deals" value={metrics.crm.totalDeals} change={null} />
                <div className="flex flex-col">
                  <span className="text-2xl font-bold">${metrics.crm.totalPipelineValue.toLocaleString()}</span>
                  <span className="text-muted-foreground text-sm">Pipeline Value</span>
                </div>
              </div>
              <div className="mt-4 flex flex-row justify-start gap-8">
                <div>
                  <p className="text-2xl font-bold text-green-600">{metrics.crm.dealsWon}</p>
                  <p className="text-muted-foreground text-xs">Deals Won</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{metrics.crm.dealsLost}</p>
                  <p className="text-muted-foreground text-xs">Deals Lost</p>
                </div>
              </div>
            </div>

            {/* Marketing Metrics */}
            <div>
              <h4 className="mb-4 text-sm font-medium">Email Marketing</h4>
              <div className="grid grid-cols-3 gap-4">
                <MetricCard label="Emails Sent" value={metrics.marketing.emailsSent} change={null} />
                <div className="flex flex-col">
                  <span className="text-2xl font-bold">{metrics.marketing.openRate}%</span>
                  <span className="text-muted-foreground text-sm">Open Rate</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold">{metrics.marketing.clickRate}%</span>
                  <span className="text-muted-foreground text-sm">Click Rate</span>
                </div>
              </div>
            </div>

            {/* Forms */}
            <div>
              <h4 className="mb-4 text-sm font-medium">Forms</h4>
              <MetricCard label="Form Submissions" value={metrics.marketing.formSubmissions} change={null} />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MetricCard } from './metric-card'
import { getHubSpotMetrics } from '@/lib/platforms/hubspot/actions'
import type { HubSpotMetrics } from '@/lib/platforms/hubspot/types'
import type { Period } from './integrations-panel'

interface HubSpotSectionProps {
  isConnected: boolean
  period: Period
}

export function HubSpotSection({ isConnected, period }: HubSpotSectionProps) {
  const [metrics, setMetrics] = useState<HubSpotMetrics | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (isConnected) {
      startTransition(async () => {
        const result = await getHubSpotMetrics(period)
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
              <CardTitle>HubSpot</CardTitle>
              <CardDescription className="mt-1">
                Connect HubSpot to view CRM metrics and form submissions.
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
      <h3 className="text-lg font-semibold">HubSpot</h3>
      {isPending ? (
        <div className="flex h-[100px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* CRM Metrics */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">CRM</h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                label="Total Contacts"
                value={metrics.crm.totalContacts}
                change={null}
              />
              <MetricCard label="Total Deals" value={metrics.crm.totalDeals} change={null} />
              <MetricCard label="New Deals" value={metrics.crm.newDeals} change={null} />
              <MetricCard
                label="Pipeline Value"
                value={metrics.crm.totalPipelineValue}
                prefix="$"
                change={null}
              />
              <MetricCard label="Deals Won" value={metrics.crm.dealsWon} change={null} />
              <MetricCard label="Deals Lost" value={metrics.crm.dealsLost} change={null} />
            </div>
          </div>

          {/* Forms */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Forms</h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                label="Form Submissions"
                value={metrics.marketing.formSubmissions}
                change={null}
                tooltip="Discovery inquiries from potential customers."
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

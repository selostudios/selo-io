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
              <CardDescription>
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
    <Card>
      <CardHeader>
        <CardTitle>HubSpot</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[280px]">
        {isPending ? (
          <div className="flex h-[260px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : metrics ? (
          <div className="space-y-6">
            {/* CRM Metrics */}
            <div>
              <h4 className="mb-4 text-sm font-medium">CRM</h4>
              <div className="grid grid-cols-3 gap-4">
                <MetricCard
                  label="Total Contacts"
                  value={metrics.crm.totalContacts}
                  change={null}
                />
                <MetricCard label="Total Deals" value={metrics.crm.totalDeals} change={null} />
                <MetricCard label="New Deals" value={metrics.crm.newDeals} change={null} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold">
                    ${metrics.crm.totalPipelineValue.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-sm">Pipeline Value</span>
                </div>
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

            {/* Forms */}
            <div>
              <h4 className="mb-4 text-sm font-medium">Forms</h4>
              <MetricCard
                label="Form Submissions"
                value={metrics.marketing.formSubmissions}
                change={null}
              />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
        )}
      </CardContent>
    </Card>
  )
}

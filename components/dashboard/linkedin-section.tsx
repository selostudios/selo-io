'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MetricCard } from './metric-card'
import { getLinkedInMetrics } from '@/lib/platforms/linkedin/actions'
import type { Period } from './integrations-panel'

interface Metric {
  label: string
  value: number
  change: number | null
}

interface LinkedInSectionProps {
  isConnected: boolean
  period: Period
}

export function LinkedInSection({ isConnected, period }: LinkedInSectionProps) {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [isPending, startTransition] = useTransition()

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
          <p className="text-muted-foreground">Connect LinkedIn to view engagement metrics.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>LinkedIn</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[80px]">
        {isPending ? (
          <div className="flex h-[60px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
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

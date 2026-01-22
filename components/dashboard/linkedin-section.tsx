'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
            <div>
              <CardTitle>LinkedIn</CardTitle>
              <CardDescription className="mt-1">Connect LinkedIn to view engagement metrics.</CardDescription>
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
      <h3 className="text-lg font-semibold">LinkedIn</h3>
      {isPending ? (
        <div className="flex h-[100px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
      ) : metrics.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
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
    </div>
  )
}

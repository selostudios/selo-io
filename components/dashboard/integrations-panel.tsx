'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { showSuccess, showError } from '@/components/ui/sonner'
import { syncLinkedInMetrics } from '@/lib/platforms/linkedin/actions'

type Connection = {
  id: string
  platform_type: string
  status: string
  last_sync_at: string | null
}

const PLATFORMS = [
  { key: 'linkedin', name: 'LinkedIn' },
  { key: 'hubspot', name: 'HubSpot' },
  { key: 'google_analytics', name: 'Google Analytics' },
] as const

interface IntegrationsPanelProps {
  connections: Connection[]
}

export function IntegrationsPanel({ connections }: IntegrationsPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const connectionMap = new Map(connections.map((c) => [c.platform_type, c]))
  const connectedCount = connections.length
  const totalCount = PLATFORMS.length

  async function handleRefreshAll() {
    setIsRefreshing(true)

    // For now, only LinkedIn has sync capability
    const linkedInConnection = connectionMap.get('linkedin')
    if (linkedInConnection) {
      const result = await syncLinkedInMetrics()
      if (result.error) {
        showError(result.error)
      } else {
        showSuccess('Integrations synced')
      }
    } else {
      showSuccess('No connected platforms to sync')
    }

    setIsRefreshing(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Integrations</CardTitle>
            <span className="text-muted-foreground text-sm font-normal">
              {connectedCount}/{totalCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isRefreshing || connectedCount === 0}
              className="h-8 w-8 p-0"
              aria-label="Refresh all integrations"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/integrations">Manage</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {PLATFORMS.map((platform) => {
            const connection = connectionMap.get(platform.key)
            const isConnected = !!connection

            return (
              <div
                key={platform.key}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <span className="font-medium">{platform.name}</span>
                {isConnected ? (
                  <div className="flex items-center gap-1.5 text-sm text-green-600">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <X className="h-4 w-4" aria-hidden="true" />
                    <span>Not connected</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

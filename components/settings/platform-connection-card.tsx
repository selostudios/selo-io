'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { disconnectPlatform } from '@/app/settings/integrations/actions'
import { displayName } from '@/lib/utils'

type Connection = {
  id: string
  platform_type: string
  status: string
  last_sync_at: string | null
}

const platformInfo = {
  hubspot: {
    name: 'HubSpot',
    description: 'Email campaigns, leads, deals, events',
  },
  google_analytics: {
    name: 'Google Analytics',
    description: 'Website traffic, conversions, UTM tracking',
  },
  linkedin: {
    name: 'LinkedIn',
    description: 'Post impressions, engagement, followers',
  },
}

export function PlatformConnectionCard({
  connection,
  platformType,
}: {
  connection: Connection | null
  platformType: string
}) {
  const platformKey = (connection?.platform_type || platformType) as keyof typeof platformInfo
  const info = platformInfo[platformKey] || {
    name: 'Unknown Platform',
    description: 'Unknown platform',
  }

  async function handleDisconnect() {
    if (connection) {
      await disconnectPlatform(connection.id)
    }
  }

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{info.name}</CardTitle>
              <CardDescription className="mt-1">{info.description}</CardDescription>
            </div>
            <Badge variant="warning">Not connected</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              window.location.href = `/api/auth/oauth/${platformType}`
            }}
          >
            Connect
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{info.name}</CardTitle>
            <CardDescription className="mt-1">{info.description}</CardDescription>
          </div>
          <Badge variant="success">{displayName(connection.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connection.last_sync_at && (
            <p className="text-muted-foreground text-sm">
              Last synced: {new Date(connection.last_sync_at).toLocaleString()}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

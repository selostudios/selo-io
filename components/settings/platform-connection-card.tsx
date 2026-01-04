import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { disconnectPlatform } from '@/app/settings/integrations/actions'
import { LinkedInConnectDialog } from '@/components/integrations/linkedin-connect-dialog'

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
    'use server'
    if (connection) {
      await disconnectPlatform(connection.id)
    }
  }

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{info.name}</CardTitle>
            <Badge variant="warning">Not connected</Badge>
          </div>
          <CardDescription>{info.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {platformType === 'linkedin' ? (
            <LinkedInConnectDialog />
          ) : (
            <p className="text-muted-foreground text-sm">
              Connect {info.name} to track performance metrics.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{info.name}</CardTitle>
          <Badge variant="success">{connection.status}</Badge>
        </div>
        <CardDescription>{info.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connection.last_sync_at && (
            <p className="text-muted-foreground text-sm">
              Last synced: {new Date(connection.last_sync_at).toLocaleString()}
            </p>
          )}
          <form action={handleDisconnect}>
            <Button type="submit" variant="outline" size="sm">
              Disconnect
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

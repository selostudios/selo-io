import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { disconnectPlatform } from '@/app/dashboard/settings/integrations/actions'

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
  meta: {
    name: 'Meta (Facebook)',
    description: 'Page insights, post performance',
  },
  instagram: {
    name: 'Instagram',
    description: 'Post impressions, engagement, followers',
  },
}

export function PlatformConnectionCard({ connection, platformType }: { connection: Connection | null, platformType: string }) {
  const info = platformInfo[connection?.platform_type as keyof typeof platformInfo || platformType as keyof typeof platformInfo]

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
          <CardTitle>{info.name}</CardTitle>
          <CardDescription>{info.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline">Not connected</Badge>
          <p className="text-sm text-muted-foreground mt-4">
            Connect {info.name} to track performance metrics.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{info.name}</CardTitle>
            <CardDescription>{info.description}</CardDescription>
          </div>
          <Badge className="bg-green-100 text-green-800">{connection.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connection.last_sync_at && (
            <p className="text-sm text-muted-foreground">
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

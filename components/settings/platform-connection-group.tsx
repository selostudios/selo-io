'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { displayName } from '@/lib/utils'
import { EditDisplayNameDialog } from './edit-display-name-dialog'
import { DisconnectConfirmDialog } from './disconnect-confirm-dialog'
import { LinkedInIcon, HubSpotIcon, GoogleAnalyticsIcon } from '@/components/icons/platform-icons'

type Connection = {
  id: string
  platform_type: string
  account_name: string | null
  display_name: string | null
  status: string
  last_sync_at: string | null
}

const platformInfo: Record<
  string,
  {
    name: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    iconColor: string
  }
> = {
  hubspot: {
    name: 'HubSpot',
    description: 'Email campaigns, leads, deals, events',
    icon: HubSpotIcon,
    iconColor: 'text-[#FF7A59]',
  },
  google_analytics: {
    name: 'Google Analytics',
    description: 'Website traffic, conversions, UTM tracking',
    icon: GoogleAnalyticsIcon,
    iconColor: 'text-[#E37400]',
  },
  linkedin: {
    name: 'LinkedIn',
    description: 'Post impressions, engagement, followers',
    icon: LinkedInIcon,
    iconColor: 'text-[#0A66C2]',
  },
}

function formatLastSyncAt(lastSyncAt: string | null): string | null {
  if (!lastSyncAt) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(lastSyncAt))
}

function getConnectionLabel(connection: Connection): string {
  return connection.display_name || connection.account_name || 'Unknown Account'
}

interface PlatformConnectionGroupProps {
  platformType: string
  connections: Connection[]
}

export function PlatformConnectionGroup({
  platformType,
  connections,
}: PlatformConnectionGroupProps) {
  const info = platformInfo[platformType] || {
    name: 'Unknown',
    description: '',
    icon: () => null,
    iconColor: '',
  }
  const Icon = info.icon

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Icon className={`size-5 ${info.iconColor}`} />
              <div>
                <CardTitle>{info.name}</CardTitle>
                <CardDescription className="mt-1">{info.description}</CardDescription>
              </div>
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
          <div className="flex items-center gap-3">
            <Icon className={`size-5 ${info.iconColor}`} />
            <div>
              <CardTitle>{info.name}</CardTitle>
              <CardDescription className="mt-1">{info.description}</CardDescription>
            </div>
          </div>
          <Badge variant="success">{connections.length} connected</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connections.map((connection) => (
          <ConnectionRow key={connection.id} connection={connection} />
        ))}
      </CardContent>
    </Card>
  )
}

function ConnectionRow({ connection }: { connection: Connection }) {
  const [editOpen, setEditOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="font-medium">{getConnectionLabel(connection)}</p>
        {connection.last_sync_at && (
          <p className="text-muted-foreground text-xs">
            Last synced: {formatLastSyncAt(connection.last_sync_at)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{displayName(connection.status)}</Badge>
        <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit display name</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setDisconnectOpen(true)}>
          <Trash2 className="text-destructive h-4 w-4" />
          <span className="sr-only">Disconnect</span>
        </Button>
      </div>

      <EditDisplayNameDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        connectionId={connection.id}
        currentName={getConnectionLabel(connection)}
      />

      <DisconnectConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        connectionId={connection.id}
        accountName={getConnectionLabel(connection)}
      />
    </div>
  )
}

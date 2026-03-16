'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlatformConnectionGroup } from '@/components/settings/platform-connection-group'
import { AddIntegrationDialog } from '@/components/settings/add-integration-dialog'

type Connection = {
  id: string
  platform_type: string
  account_name: string | null
  display_name: string | null
  status: string
  last_sync_at: string | null
}

interface IntegrationsPageContentProps {
  connectionsByPlatform: Record<string, Connection[]>
}

const platformOrder = ['linkedin', 'hubspot', 'google_analytics'] as const

export function IntegrationsPageContent({ connectionsByPlatform }: IntegrationsPageContentProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Platform Integrations</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect your marketing platforms to track campaign performance
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      <div className="space-y-6">
        {platformOrder.map((platform) => (
          <PlatformConnectionGroup
            key={platform}
            platformType={platform}
            connections={connectionsByPlatform[platform] || []}
          />
        ))}
      </div>

      <AddIntegrationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

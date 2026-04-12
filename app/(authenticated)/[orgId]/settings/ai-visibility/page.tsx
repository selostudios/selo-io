import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AIVisibilityConfigForm } from '@/components/ai-visibility/config-form'
import { getAIVisibilityConfig } from '@/lib/ai-visibility/queries'
import { getAvailablePlatforms } from '@/lib/ai-visibility/platforms/provider-keys'
import { canManageOrg } from '@/lib/permissions'
import { withSettingsAuth } from '@/lib/auth/settings-auth'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function AIVisibilitySettingsPage({ params }: PageProps) {
  const { orgId } = await params
  const result = await withSettingsAuth(
    orgId,
    async (organizationId, { isInternal, userRecord }) => {
      if (!isInternal && !canManageOrg(userRecord.role)) {
        redirect('/settings/team')
      }

      const supabase = await createClient()

      const [config, availablePlatforms] = await Promise.all([
        getAIVisibilityConfig(supabase, organizationId),
        getAvailablePlatforms(),
      ])

      return { config, availablePlatforms }
    }
  )

  const { config, availablePlatforms } = result.data

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">AI Visibility</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure AI visibility tracking across AI platforms
        </p>
      </div>

      {availablePlatforms.length > 0 ? (
        <AIVisibilityConfigForm
          orgId={orgId}
          config={config}
          availablePlatforms={availablePlatforms}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          No AI platform API keys are configured. Contact your Selo admin to set up API keys in App
          Settings.
        </p>
      )}
    </div>
  )
}

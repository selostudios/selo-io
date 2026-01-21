import { createClient } from '@/lib/supabase/server'
import { CreateCampaignDialog } from '@/components/campaigns/create-campaign-dialog'
import { CampaignCard } from '@/components/campaigns/campaign-card'
import { canManageCampaigns } from '@/lib/permissions'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user!.id)
    .single()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('organization_id', userRecord!.organization_id)
    .order('created_at', { ascending: false })

  const canCreateCampaign = canManageCampaigns(userRecord!.role)

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Manage your marketing campaigns and track performance
          </p>
        </div>
        {canCreateCampaign && <CreateCampaignDialog />}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">
          All Campaigns{campaigns && campaigns.length > 0 ? ` (${campaigns.length})` : ''}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns?.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
          {(!campaigns || campaigns.length === 0) && (
            <div className="col-span-full space-y-4 rounded-lg border-2 border-dashed border-neutral-300 p-12 text-center">
              <p className="text-muted-foreground">No campaigns yet.</p>
              {canCreateCampaign && <CreateCampaignDialog buttonText="Create Campaign" />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

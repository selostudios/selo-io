import { createClient } from '@/lib/supabase/server'
import { CreateCampaignDialog } from '@/components/campaigns/create-campaign-dialog'
import { CampaignCard } from '@/components/campaigns/campaign-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

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

  const canCreateCampaign = ['admin', 'team_member'].includes(userRecord!.role)

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Manage your marketing campaigns and track performance
          </p>
        </div>
        {canCreateCampaign && <CreateCampaignDialog />}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">
          All Campaigns ({campaigns?.length || 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns?.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
          {(!campaigns || campaigns.length === 0) && (
            <p className="text-muted-foreground col-span-full text-center py-8">
              No campaigns yet. Create your first campaign to get started!
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

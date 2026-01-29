import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { deleteCampaign } from '../actions'
import { DeleteCampaignButton } from '@/components/campaigns/delete-campaign-button'
import { formatDate, displayName, CampaignStatus } from '@/lib/utils'
import { EditableDescription } from '@/components/campaigns/editable-description'
import { EditableUtmSection } from '@/components/campaigns/editable-utm-section'
import { canManageCampaigns, isInternalUser } from '@/lib/permissions'

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ org?: string }>
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: CampaignDetailPageProps) {
  const { id } = await params
  const { org: selectedOrgId } = await searchParams
  const supabase = await createClient()

  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).single()

  if (!campaign) {
    notFound()
  }

  // Get user's role and organization
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('role, organization_id, is_internal')
    .eq('id', user?.id)
    .single()

  if (!userRecord) {
    redirect('/login')
  }

  const isInternal = isInternalUser(userRecord)

  // Determine which organization the user is viewing
  const viewingOrgId = isInternal && selectedOrgId ? selectedOrgId : userRecord.organization_id

  // Verify the campaign belongs to the organization being viewed
  if (campaign.organization_id !== viewingOrgId) {
    notFound()
  }

  const canDelete = canManageCampaigns(userRecord?.role)

  async function handleDelete() {
    'use server'
    const result = await deleteCampaign((await params).id)
    if (!result?.error) {
      redirect('/dashboard/campaigns')
    }
  }

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <Badge
            style={{
              backgroundColor:
                campaign.status === CampaignStatus.Draft
                  ? '#fef9c3'
                  : campaign.status === CampaignStatus.Active
                    ? '#dcfce7'
                    : campaign.status === CampaignStatus.Completed
                      ? '#dbeafe'
                      : '#fee2e2',
              color:
                campaign.status === CampaignStatus.Draft
                  ? '#854d0e'
                  : campaign.status === CampaignStatus.Active
                    ? '#166534'
                    : campaign.status === CampaignStatus.Completed
                      ? '#1e40af'
                      : '#991b1b',
            }}
          >
            {displayName(campaign.status)}
          </Badge>
        </div>
        <DeleteCampaignButton canDelete={canDelete} onDelete={handleDelete} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <EditableDescription campaignId={campaign.id} currentDescription={campaign.description} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Start Date</p>
              <p>{campaign.start_date ? formatDate(campaign.start_date, false) : 'Not set'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">End Date</p>
              <p>{campaign.end_date ? formatDate(campaign.end_date, false) : 'Not set'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <EditableUtmSection
            campaignId={campaign.id}
            initialValues={{
              utm_source: campaign.utm_source || '',
              utm_medium: campaign.utm_medium || '',
              utm_campaign: campaign.utm_campaign || '',
              utm_term: campaign.utm_term || '',
              utm_content: campaign.utm_content || '',
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Metrics will appear here once platform integrations are connected.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

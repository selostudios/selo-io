import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteCampaign } from '../actions'
import { formatDate, displayName, CampaignStatus } from '@/lib/utils'
import { UtmParamRow } from '@/components/campaigns/utm-param-row'
import { UtmMediumSelect } from '@/components/campaigns/utm-medium-select'
import { EditableDescription } from '@/components/campaigns/editable-description'
import { RegenerateUtmButton } from '@/components/campaigns/regenerate-utm-button'

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).single()

  if (!campaign) {
    notFound()
  }

  // Get user's role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', user?.id)
    .single()

  const isAdmin = userRecord?.role === 'admin'

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
                campaign.status === CampaignStatus.DRAFT
                  ? '#fef9c3'
                  : campaign.status === CampaignStatus.ACTIVE
                    ? '#dcfce7'
                    : campaign.status === CampaignStatus.COMPLETED
                      ? '#dbeafe'
                      : '#fee2e2',
              color:
                campaign.status === CampaignStatus.DRAFT
                  ? '#854d0e'
                  : campaign.status === CampaignStatus.ACTIVE
                    ? '#166534'
                    : campaign.status === CampaignStatus.COMPLETED
                      ? '#1e40af'
                      : '#991b1b',
            }}
          >
            {displayName(campaign.status)}
          </Badge>
        </div>
        <form action={handleDelete}>
          <Button type="submit" variant="destructive">
            Delete Campaign
          </Button>
        </form>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>UTM Parameters</CardTitle>
          {isAdmin && <RegenerateUtmButton campaignId={campaign.id} />}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <UtmParamRow
              label="utm_source"
              value={campaign.utm_source || ''}
              description="Identifies which site or platform sent the traffic (e.g., linkedin, facebook, newsletter)"
            />
            <UtmMediumSelect
              campaignId={campaign.id}
              currentValue={campaign.utm_medium || ''}
              description="Identifies the marketing medium or channel type (e.g., social, email, cpc, organic)"
            />
            <UtmParamRow
              label="utm_campaign"
              value={campaign.utm_campaign || ''}
              description="Identifies the specific campaign name or promotion (e.g., spring-sale, product-launch)"
            />
            <UtmParamRow
              label="utm_term"
              value={campaign.utm_term || ''}
              description="Identifies target audience, keywords, or ad groups (e.g., marketing-managers, uk-audience)"
            />
            <UtmParamRow
              label="utm_content"
              value={campaign.utm_content || ''}
              description="Differentiates similar content or links - use for A/B testing, content format, or link placement (e.g., video-cta, carousel-post)"
            />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            Use these parameters when creating content in HubSpot, LinkedIn, and other platforms.
          </p>
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

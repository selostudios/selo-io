import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteCampaign } from '../actions'
import { formatDate } from '@/lib/utils'
import { UtmParamRow } from '@/components/campaigns/utm-param-row'
import { UtmMediumSelect } from '@/components/campaigns/utm-medium-select'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (!campaign) {
    notFound()
  }

  async function handleDelete() {
    'use server'
    const result = await deleteCampaign((await params).id)
    if (!result?.error) {
      redirect('/dashboard/campaigns')
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <Badge className="mt-2">{campaign.status}</Badge>
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
          {campaign.description && (
            <CardDescription>{campaign.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Date</p>
              <p>{campaign.start_date ? formatDate(campaign.start_date, false) : 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Date</p>
              <p>{campaign.end_date ? formatDate(campaign.end_date, false) : 'Not set'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UTM Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <UtmParamRow label="utm_source" value={campaign.utm_source} />
            <UtmMediumSelect campaignId={campaign.id} currentValue={campaign.utm_medium} />
            <UtmParamRow label="utm_campaign" value={campaign.utm_campaign} />
            {campaign.utm_term && (
              <UtmParamRow label="utm_term" value={campaign.utm_term} />
            )}
            {campaign.utm_content && (
              <UtmParamRow label="utm_content" value={campaign.utm_content} />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
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

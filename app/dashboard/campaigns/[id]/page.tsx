import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteCampaign } from '../actions'

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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Start Date</p>
              <p>{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Date</p>
              <p>{campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : 'Not set'}</p>
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
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
              <span className="font-mono text-sm">utm_source</span>
              <code className="text-sm">{campaign.utm_source}</code>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
              <span className="font-mono text-sm">utm_medium</span>
              <code className="text-sm">{campaign.utm_medium}</code>
            </div>
            <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
              <span className="font-mono text-sm">utm_campaign</span>
              <code className="text-sm">{campaign.utm_campaign}</code>
            </div>
            {campaign.utm_term && (
              <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
                <span className="font-mono text-sm">utm_term</span>
                <code className="text-sm">{campaign.utm_term}</code>
              </div>
            )}
            {campaign.utm_content && (
              <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
                <span className="font-mono text-sm">utm_content</span>
                <code className="text-sm">{campaign.utm_content}</code>
              </div>
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

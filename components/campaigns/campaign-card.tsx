import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatDate, displayName, type CampaignStatusType } from '@/lib/utils'

type Campaign = {
  id: string
  name: string
  status: CampaignStatusType
  start_date: string | null
  end_date: string | null
  created_at: string
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link href={`/dashboard/campaigns/${campaign.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            <Badge variant={campaign.status}>{displayName(campaign.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex justify-between text-sm">
            {campaign.start_date && <p>Starts: {formatDate(campaign.start_date, false)}</p>}
            {campaign.end_date && <p>Ends: {formatDate(campaign.end_date, false)}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

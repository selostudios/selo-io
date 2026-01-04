import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatDate, displayName } from '@/lib/utils'

type Campaign = {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const statusVariant = campaign.status as 'draft' | 'active' | 'disabled' | 'completed'

  return (
    <Link href={`/dashboard/campaigns/${campaign.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{campaign.name}</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Created {formatDate(campaign.created_at, false)}
              </p>
            </div>
            <Badge variant={statusVariant}>{displayName(campaign.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground space-y-1 text-sm">
            {campaign.start_date && <p>Starts: {formatDate(campaign.start_date, false)}</p>}
            {campaign.end_date && <p>Ends: {formatDate(campaign.end_date, false)}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

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
  const statusColors = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    disabled: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
  }

  return (
    <Link href={`/dashboard/campaigns/${campaign.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
              {displayName(campaign.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground space-y-1 text-sm">
            {campaign.start_date && <p>Starts: {formatDate(campaign.start_date, false)}</p>}
            {campaign.end_date && <p>Ends: {formatDate(campaign.end_date, false)}</p>}
            <p>Created: {formatDate(campaign.created_at)}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

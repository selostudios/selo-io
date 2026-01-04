import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

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
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
  }

  return (
    <Link href={`/dashboard/campaigns/${campaign.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{campaign.name}</CardTitle>
            <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
              {campaign.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1">
            {campaign.start_date && (
              <p>Starts: {formatDate(campaign.start_date, false)}</p>
            )}
            {campaign.end_date && (
              <p>Ends: {formatDate(campaign.end_date, false)}</p>
            )}
            <p>Created: {formatDate(campaign.created_at)}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

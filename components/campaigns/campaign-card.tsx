import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

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
              <p>Starts: {new Date(campaign.start_date).toLocaleDateString()}</p>
            )}
            {campaign.end_date && (
              <p>Ends: {new Date(campaign.end_date).toLocaleDateString()}</p>
            )}
            <p>Created: {new Date(campaign.created_at).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

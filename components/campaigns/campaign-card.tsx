import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatDate, displayName, CampaignStatus, type CampaignStatusType } from '@/lib/utils'

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
            <div>
              <CardTitle className="text-lg">{campaign.name}</CardTitle>
              <p className="mt-1 text-sm text-neutral-700">
                {formatDate(campaign.created_at, false)}
              </p>
            </div>
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
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-sm text-neutral-700">
            {campaign.start_date && <p>Starts: {formatDate(campaign.start_date, false)}</p>}
            {campaign.end_date && <p>Ends: {formatDate(campaign.end_date, false)}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

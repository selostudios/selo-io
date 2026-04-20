import type { QuarterPeriods } from '@/lib/reviews/period'
import type { SnapshotData } from '@/lib/reviews/types'
import { fetchGAData } from './ga'
import { fetchLinkedInData } from './linkedin'
import { fetchHubSpotData, fetchEmailData } from './hubspot'
import { fetchAuditData } from './audit'

export { fetchGAData, fetchLinkedInData, fetchHubSpotData, fetchEmailData, fetchAuditData }

export async function fetchAllData(
  organizationId: string,
  periods: QuarterPeriods
): Promise<SnapshotData> {
  const [ga, linkedin, hubspot, email, audit] = await Promise.all([
    fetchGAData(organizationId, periods).catch(() => undefined),
    fetchLinkedInData(organizationId, periods).catch(() => undefined),
    fetchHubSpotData(organizationId, periods).catch(() => undefined),
    fetchEmailData(organizationId, periods).catch(() => undefined),
    fetchAuditData(organizationId).catch(() => undefined),
  ])
  return {
    ...(ga && { ga }),
    ...(linkedin && { linkedin }),
    ...(hubspot && { hubspot }),
    ...(email && { email }),
    ...(audit && { audit }),
  }
}

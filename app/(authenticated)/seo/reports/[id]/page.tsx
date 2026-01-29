import { notFound } from 'next/navigation'
import { ReportDetailClient } from './client'
import { getReportWithAudits, getReportAuditData, generateSummaryForReport } from '../actions'
import { transformToPresentation } from './transform'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ share?: string; settings?: string }>
}

export default async function ReportDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { share, settings } = await searchParams

  // Get report with all audit data
  const report = await getReportWithAudits(id).catch((error) => {
    console.error('[Report Page Error]', error)
    return null
  })

  if (!report) {
    notFound()
  }

  const auditData = await getReportAuditData(report)

  // Generate summary if not already generated
  if (!report.executive_summary) {
    await generateSummaryForReport(id)
    // Re-fetch to get the summary
    const updatedReport = await getReportWithAudits(id)
    Object.assign(report, updatedReport)
  }

  // Transform to presentation data
  const presentationData = transformToPresentation(report, auditData)

  return (
    <ReportDetailClient
      report={report}
      presentationData={presentationData}
      showShareModal={share === 'true'}
      showSettings={settings === 'true'}
    />
  )
}

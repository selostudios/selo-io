'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ReportPresentation } from '@/components/reports/report-presentation'
import { ShareModal } from '@/components/share/share-modal'
import { SharedResourceType } from '@/lib/enums'
import { SettingsDialog } from '@/components/reports/settings-dialog'
import { generateSummaryForReport } from '../actions'
import type { GeneratedReportWithAudits, ReportPresentationData } from '@/lib/reports/types'

interface ReportDetailClientProps {
  report: GeneratedReportWithAudits
  presentationData: ReportPresentationData
  showShareModal?: boolean
  showSettings?: boolean
  needsSummary?: boolean
}

export function ReportDetailClient({
  report,
  presentationData,
  showShareModal = false,
  showSettings = false,
  needsSummary = false,
}: ReportDetailClientProps) {
  const router = useRouter()
  const [shareModalOpen, setShareModalOpen] = useState(showShareModal)
  const [settingsOpen, setSettingsOpen] = useState(showSettings)
  const summaryTriggered = useRef(false)

  useEffect(() => {
    if (needsSummary && !summaryTriggered.current) {
      summaryTriggered.current = true
      generateSummaryForReport(report.id).then((result) => {
        if (!result?.success) {
          console.error('[Generate Summary Failed]', {
            type: 'client_summary_generation_failed',
            reportId: report.id,
            error: result?.error,
            timestamp: new Date().toISOString(),
          })
        }
        // Refresh in both branches so the server can render the
        // "no summary yet" state based on report.executive_summary being null.
        router.refresh()
      })
    }
  }, [needsSummary, report.id, router])

  const handleShare = () => {
    setShareModalOpen(true)
  }

  const handleSettingsSaved = () => {
    // Refresh the page to get updated data
    router.refresh()
  }

  return (
    <>
      <ReportPresentation data={presentationData} onShare={handleShare} />

      {/* Share Modal */}
      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        resourceType={SharedResourceType.Report}
        resourceId={report.id}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        report={report}
        onSaved={handleSettingsSaved}
      />
    </>
  )
}

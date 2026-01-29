'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReportPresentation } from '@/components/reports/report-presentation'
import { ShareModal } from '@/components/reports/share-modal'
import { SettingsDialog } from '@/components/reports/settings-dialog'
import type { GeneratedReportWithAudits, ReportPresentationData } from '@/lib/reports/types'

interface ReportDetailClientProps {
  report: GeneratedReportWithAudits
  presentationData: ReportPresentationData
  showShareModal?: boolean
  showSettings?: boolean
}

export function ReportDetailClient({
  report,
  presentationData,
  showShareModal = false,
  showSettings = false,
}: ReportDetailClientProps) {
  const router = useRouter()
  const [shareModalOpen, setShareModalOpen] = useState(showShareModal)
  const [settingsOpen, setSettingsOpen] = useState(showSettings)

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
        reportId={report.id}
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

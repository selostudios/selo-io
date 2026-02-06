'use client'

import { useState } from 'react'
import { AuditReport } from '@/components/audit/audit-report'
import { ShareModal } from '@/components/share/share-modal'
import { SharedResourceType } from '@/lib/enums'
import type { SiteAudit, SiteAuditCheck, SiteAuditPage } from '@/lib/audit/types'

interface SiteAuditDetailClientProps {
  audit: SiteAudit
  checks: SiteAuditCheck[]
  pages: SiteAuditPage[]
}

export function SiteAuditDetailClient({ audit, checks, pages }: SiteAuditDetailClientProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false)

  return (
    <>
      <AuditReport
        audit={audit}
        checks={checks}
        pages={pages}
        onShare={() => setShareModalOpen(true)}
      />
      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        resourceType={SharedResourceType.SiteAudit}
        resourceId={audit.id}
      />
    </>
  )
}

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'

interface DeprecationBannerProps {
  auditType: string
  orgId: string
}

export function DeprecationBanner({ auditType, orgId }: DeprecationBannerProps) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
      <AlertTriangle className="size-5 shrink-0 text-yellow-600" />
      <p className="text-sm text-yellow-800">
        {auditType} has been replaced by the{' '}
        <Link href={`/${orgId}/seo/audit`} className="font-medium underline hover:text-yellow-900">
          Full Site Audit
        </Link>
        , which combines SEO, Performance, and AI Readiness into a single comprehensive audit.
      </p>
      <Link
        href={`/${orgId}/seo/audit`}
        className="ml-auto flex shrink-0 items-center gap-1 text-sm font-medium text-yellow-700 hover:text-yellow-900"
      >
        Go to Full Site Audit
        <ArrowRight className="size-4" />
      </Link>
    </div>
  )
}

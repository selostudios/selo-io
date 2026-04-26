import { cn } from '@/lib/utils'
import { BackLink } from './back-link'
import { ReportTitle } from './report-title'
import { ReportHeaderActions } from './report-header-actions'

export interface ReportEditorHeaderProps {
  backHref: string
  title: string
  quarter: string
  actions?: React.ReactNode
  className?: string
}

export function ReportEditorHeader({
  backHref,
  title,
  quarter,
  actions,
  className,
}: ReportEditorHeaderProps) {
  return (
    <header className={cn('space-y-3 border-b px-6 py-4', className)}>
      <BackLink href={backHref} />
      <div className="flex items-center justify-between gap-4">
        <ReportTitle title={title} quarter={quarter} />
        <ReportHeaderActions>{actions}</ReportHeaderActions>
      </div>
    </header>
  )
}

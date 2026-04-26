import { cn } from '@/lib/utils'
import { BackLink } from './back-link'
import { ReportTitle } from './report-title'
import { ReportHeaderActions } from './report-header-actions'

export interface ReportEditorHeaderProps {
  backHref: string
  backLabel?: string
  title: string
  quarter: string
  actions?: React.ReactNode
  className?: string
}

export function ReportEditorHeader({
  backHref,
  backLabel,
  title,
  quarter,
  actions,
  className,
}: ReportEditorHeaderProps) {
  return (
    <header className={cn('flex items-center justify-between gap-4 border-b px-6 py-4', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <BackLink href={backHref} label={backLabel} />
      </div>
      <div className="flex min-w-0 flex-1 justify-center">
        <ReportTitle title={title} quarter={quarter} />
      </div>
      <div className="flex flex-1 justify-end">
        <ReportHeaderActions>{actions}</ReportHeaderActions>
      </div>
    </header>
  )
}

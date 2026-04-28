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
    <header className={cn('flex items-center gap-4 border-b px-6 py-4', className)}>
      <BackLink href={backHref} className="flex-shrink-0" />
      <ReportTitle title={title} quarter={quarter} className="min-w-0 flex-1" />
      <ReportHeaderActions>{actions}</ReportHeaderActions>
    </header>
  )
}

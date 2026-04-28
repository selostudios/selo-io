import { cn } from '@/lib/utils'

export interface ReportTitleProps {
  title: string
  quarter: string
  className?: string
}

export function ReportTitle({ title, quarter, className }: ReportTitleProps) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <h1 className="text-foreground text-lg leading-tight font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{quarter}</p>
    </div>
  )
}

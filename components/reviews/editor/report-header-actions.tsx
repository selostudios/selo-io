'use client'

import { cn } from '@/lib/utils'

export interface ReportHeaderActionsProps {
  children?: React.ReactNode
  className?: string
}

export function ReportHeaderActions({ children, className }: ReportHeaderActionsProps) {
  return (
    <div
      data-testid="report-editor-header-actions"
      className={cn('flex items-center gap-2', className)}
    >
      {children}
    </div>
  )
}

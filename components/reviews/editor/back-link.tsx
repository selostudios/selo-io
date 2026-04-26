import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface BackLinkProps {
  href: string
  label?: string
  className?: string
}

export function BackLink({ href, label = '← Back', className }: BackLinkProps) {
  return (
    <Link
      href={href}
      data-testid="report-editor-back-link"
      className={cn(
        'text-muted-foreground hover:text-foreground text-sm transition-colors',
        className
      )}
    >
      {label}
    </Link>
  )
}

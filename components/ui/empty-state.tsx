import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-8 text-center',
        className
      )}
    >
      <Icon className="text-muted-foreground/50 mb-3 size-10" strokeWidth={1.5} />
      <p className="text-muted-foreground font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground/70 mt-1 text-sm">{description}</p>
      )}
    </div>
  )
}

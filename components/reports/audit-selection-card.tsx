import { Loader2, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { getScoreStatus, getScoreBadgeVariant } from '@/lib/reports'

export interface AuditItem {
  id: string
  domain: string
  date: string
  score?: number | null
  subtitle?: string
}

interface AuditSelectionCardProps {
  icon: LucideIcon
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  audits: AuditItem[]
  inProgressAudits: AuditItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  'data-testid'?: string
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function ScoreBadge({ score }: { score: number }) {
  const status = getScoreStatus(score)
  const variant = getScoreBadgeVariant(status)
  return (
    <Badge variant={variant} className="font-mono text-xs">
      {score}
    </Badge>
  )
}

export function AuditSelectionCard({
  icon: Icon,
  title,
  description,
  emptyTitle,
  emptyDescription,
  audits,
  inProgressAudits,
  selectedId,
  onSelect,
  'data-testid': testId,
}: AuditSelectionCardProps) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {audits.length === 0 && inProgressAudits.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={emptyTitle}
            description={emptyDescription}
            className="py-4"
          />
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {/* In-progress audits (shown first, disabled) */}
            {inProgressAudits.map((audit) => (
              <div
                key={audit.id}
                className="w-full cursor-not-allowed rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 opacity-70"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-neutral-500">
                    {audit.domain}
                  </span>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                    <Badge variant="outline" className="text-xs">
                      In Progress
                    </Badge>
                  </div>
                </div>
                <div className="text-muted-foreground mt-1 text-xs">{formatDate(audit.date)}</div>
              </div>
            ))}
            {/* Completed audits (selectable) */}
            {audits.map((audit) => (
              <button
                key={audit.id}
                onClick={() => onSelect(audit.id)}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  selectedId === audit.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">{audit.domain}</span>
                  {audit.score != null && <ScoreBadge score={audit.score} />}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {formatDate(audit.date)}
                  {audit.subtitle && ` · ${audit.subtitle}`}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type FeedbackWithRelations,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from '@/lib/types/feedback'

interface SupportTableProps {
  feedback: FeedbackWithRelations[]
  onView: (feedback: FeedbackWithRelations) => void
  onDelete?: (feedback: FeedbackWithRelations) => void
  canEdit?: boolean
}

export function SupportTable({ feedback, onView, onDelete, canEdit = false }: SupportTableProps) {
  if (feedback.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No feedback items found"
        description="Feedback submissions will appear here when users report issues or share suggestions"
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Submitted By</TableHead>
          <TableHead>Created</TableHead>
          {canEdit && <TableHead className="w-[100px]" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {feedback.map((item) => (
          <TableRow key={item.id} className="hover:bg-muted/50">
            <TableCell className="font-medium">{item.title}</TableCell>
            <TableCell>
              <Badge className={CATEGORY_COLORS[item.category]}>
                {CATEGORY_LABELS[item.category]}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={STATUS_COLORS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
            </TableCell>
            <TableCell>
              {item.priority ? (
                <Badge className={PRIORITY_COLORS[item.priority]}>
                  {PRIORITY_LABELS[item.priority]}
                </Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {item.submitter
                ? `${item.submitter.first_name ?? ''} ${item.submitter.last_name ?? ''}`.trim() ||
                  item.submitter.email ||
                  'Unknown'
                : 'Unknown'}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </TableCell>
            {canEdit && (
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView(item)}
                    aria-label="View feedback"
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete?.(item)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete feedback"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

'use client'

import { formatDistanceToNow } from 'date-fns'
import { MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  onRowClick: (feedback: FeedbackWithRelations) => void
}

export function SupportTable({ feedback, onRowClick }: SupportTableProps) {
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {feedback.map((item) => (
          <TableRow
            key={item.id}
            onClick={() => onRowClick(item)}
            className="hover:bg-muted/50 cursor-pointer"
          >
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

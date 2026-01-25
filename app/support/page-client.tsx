'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Headphones } from 'lucide-react'
import { SupportTable } from '@/components/support/support-table'
import { SupportFilters } from '@/components/support/support-filters'
import { SupportSlideout } from '@/components/support/support-slideout'
import type {
  FeedbackWithRelations,
  FeedbackStatus,
  FeedbackCategory,
  FeedbackPriority,
} from '@/lib/types/feedback'

interface SupportPageClientProps {
  feedback: FeedbackWithRelations[]
  initialIssueId?: string
}

export function SupportPageClient({ feedback, initialIssueId }: SupportPageClientProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | undefined>(undefined)
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | undefined>(undefined)
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | undefined>(undefined)

  // Find initial feedback item from URL
  const initialFeedbackItem = useMemo(() => {
    if (!initialIssueId) return null
    return feedback.find((f) => f.id === initialIssueId) ?? null
  }, [initialIssueId, feedback])

  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackWithRelations | null>(
    initialFeedbackItem
  )
  const [slideoutOpen, setSlideoutOpen] = useState(!!initialFeedbackItem)

  const filteredFeedback = feedback.filter((item) => {
    if (statusFilter !== undefined && item.status !== statusFilter) return false
    if (categoryFilter !== undefined && item.category !== categoryFilter) return false
    if (priorityFilter !== undefined && item.priority !== priorityFilter) return false
    return true
  })

  const handleRowClick = (item: FeedbackWithRelations) => {
    setSelectedFeedback(item)
    setSlideoutOpen(true)
    router.push(`/support?issue=${item.id}`, { scroll: false })
  }

  const handleClose = () => {
    setSlideoutOpen(false)
    setSelectedFeedback(null)
    router.push('/support', { scroll: false })
  }

  const handleUpdate = () => {
    router.refresh()
  }

  const clearFilters = () => {
    setStatusFilter(undefined)
    setCategoryFilter(undefined)
    setPriorityFilter(undefined)
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-start gap-3">
        <Headphones className="mt-1 h-8 w-8 text-neutral-700" aria-hidden="true" />
        <div>
          <h1 className="text-3xl font-bold">Support</h1>
          <p className="text-muted-foreground">
            Manage user feedback and issues from across the platform
          </p>
        </div>
      </div>

      <SupportFilters
        status={statusFilter}
        category={categoryFilter}
        priority={priorityFilter}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
        onPriorityChange={setPriorityFilter}
        onClear={clearFilters}
      />

      <SupportTable feedback={filteredFeedback} onRowClick={handleRowClick} />

      <SupportSlideout
        feedback={selectedFeedback}
        open={slideoutOpen}
        onClose={handleClose}
        onUpdate={handleUpdate}
      />
    </div>
  )
}

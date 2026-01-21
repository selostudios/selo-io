'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  STATUS_OPTIONS,
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  type FeedbackStatus,
  type FeedbackCategory,
  type FeedbackPriority,
} from '@/lib/types/feedback'

interface SupportFiltersProps {
  status: FeedbackStatus | undefined
  category: FeedbackCategory | undefined
  priority: FeedbackPriority | undefined
  onStatusChange: (value: FeedbackStatus | undefined) => void
  onCategoryChange: (value: FeedbackCategory | undefined) => void
  onPriorityChange: (value: FeedbackPriority | undefined) => void
  onClear: () => void
}

export function SupportFilters({
  status,
  category,
  priority,
  onStatusChange,
  onCategoryChange,
  onPriorityChange,
  onClear,
}: SupportFiltersProps) {
  const hasActiveFilters = status !== undefined || category !== undefined || priority !== undefined

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={status ?? ''}
        onValueChange={(value) => onStatusChange(value ? (value as FeedbackStatus) : undefined)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={category ?? ''}
        onValueChange={(value) => onCategoryChange(value ? (value as FeedbackCategory) : undefined)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={priority ?? ''}
        onValueChange={(value) => onPriorityChange(value ? (value as FeedbackPriority) : undefined)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Priorities" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  )
}

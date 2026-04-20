'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createReview } from '@/lib/reviews/actions'

interface Props {
  orgId: string
  quarters: string[]
  defaultQuarter: string
}

export function NewReviewForm({ orgId, quarters, defaultQuarter }: Props) {
  const router = useRouter()
  const [quarter, setQuarter] = useState(defaultQuarter)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createReview({ organizationId: orgId, quarter })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(`/${orgId}/reports/performance/${result.reviewId}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="new-review-form">
      <div className="space-y-2">
        <label htmlFor="quarter" className="text-sm font-medium">
          Quarter
        </label>
        <Select value={quarter} onValueChange={setQuarter}>
          <SelectTrigger
            id="quarter"
            className="w-full max-w-xs"
            data-testid="new-review-quarter-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {quarters.map((q) => (
              <SelectItem key={q} value={q}>
                {q}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-destructive text-sm" data-testid="new-review-error">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} data-testid="new-review-submit">
          {isPending ? 'Creating…' : 'Create review'}
        </Button>
      </div>
    </form>
  )
}

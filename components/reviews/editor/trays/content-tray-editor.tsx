'use client'

import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'
import { ProseField } from '@/components/reviews/editor/fields/prose-field'

interface Props {
  reviewId: string
  initialValue: string
  disabled?: boolean
}

export function ContentTrayEditor({ reviewId, initialValue, disabled }: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    'content_highlights',
    initialValue
  )
  return (
    <ProseField
      name="content_highlights"
      label="What resonated"
      hint="Highlight one or two posts that drove the most engagement and why they landed (≤ 100 words)."
      value={value}
      onChange={setValue}
      status={status}
      errorMessage={errorMessage}
      disabled={disabled}
    />
  )
}

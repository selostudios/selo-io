'use client'

import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'
import { SubtitleField } from '@/components/reviews/editor/fields/subtitle-field'

interface Props {
  reviewId: string
  initialValue: string
  disabled?: boolean
}

export function CoverTrayEditor({ reviewId, initialValue, disabled }: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    'cover_subtitle',
    initialValue
  )
  return (
    <SubtitleField
      name="cover_subtitle"
      label="Cover subtitle"
      hint="One-liner capturing the quarter’s headline story (≤ 20 words)."
      value={value}
      onChange={setValue}
      status={status}
      errorMessage={errorMessage}
      limit={240}
      disabled={disabled}
    />
  )
}

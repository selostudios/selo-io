'use client'

import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'
import { ProseField } from '@/components/reviews/editor/fields/prose-field'

interface Props {
  reviewId: string
  initialValue: string
  disabled?: boolean
}

export function GaTrayEditor({ reviewId, initialValue, disabled }: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    'ga_summary',
    initialValue
  )
  return (
    <ProseField
      name="ga_summary"
      label="Google Analytics summary"
      hint="Narrative over sessions, users, and engagement — call out the biggest deltas (≤ 120 words)."
      value={value}
      onChange={setValue}
      status={status}
      errorMessage={errorMessage}
      disabled={disabled}
    />
  )
}

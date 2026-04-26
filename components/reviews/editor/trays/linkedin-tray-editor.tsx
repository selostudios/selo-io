'use client'

import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'
import { ProseField } from '@/components/reviews/editor/fields/prose-field'

interface Props {
  reviewId: string
  initialValue: string
  disabled?: boolean
}

export function LinkedInTrayEditor({ reviewId, initialValue, disabled }: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    'linkedin_insights',
    initialValue
  )
  return (
    <ProseField
      name="linkedin_insights"
      label="LinkedIn insights"
      hint="Follower growth, impression trends, top themes from top posts (≤ 120 words)."
      value={value}
      onChange={setValue}
      status={status}
      errorMessage={errorMessage}
      disabled={disabled}
    />
  )
}

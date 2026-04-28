'use client'

import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'
import { ProseField } from '@/components/reviews/editor/fields/prose-field'
import { TrayShell } from './tray-shell'

interface Props {
  reviewId: string
  initialValue: string
  noteInitialValue: string | null
  disabled?: boolean
}

export function LinkedInTrayEditor({ reviewId, initialValue, noteInitialValue, disabled }: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    'linkedin_insights',
    initialValue
  )
  return (
    <TrayShell reviewId={reviewId} blockKey="linkedin_insights" noteInitialValue={noteInitialValue}>
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
    </TrayShell>
  )
}

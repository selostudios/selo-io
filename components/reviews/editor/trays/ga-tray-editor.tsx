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

export function GaTrayEditor({ reviewId, initialValue, noteInitialValue, disabled }: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    'ga_summary',
    initialValue
  )
  return (
    <TrayShell reviewId={reviewId} blockKey="ga_summary" noteInitialValue={noteInitialValue}>
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
    </TrayShell>
  )
}

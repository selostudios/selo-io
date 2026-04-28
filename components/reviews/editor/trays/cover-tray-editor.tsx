'use client'

import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'
import { SubtitleField } from '@/components/reviews/editor/fields/subtitle-field'
import { TrayShell } from './tray-shell'

interface Props {
  reviewId: string
  initialValue: string
  noteInitialValue: string | null
  disabled?: boolean
}

export function CoverTrayEditor({ reviewId, initialValue, noteInitialValue, disabled }: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    'cover_subtitle',
    initialValue
  )
  return (
    <TrayShell reviewId={reviewId} blockKey="cover_subtitle" noteInitialValue={noteInitialValue}>
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
    </TrayShell>
  )
}

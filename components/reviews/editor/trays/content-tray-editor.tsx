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

export function ContentTrayEditor({ reviewId, initialValue, noteInitialValue, disabled }: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    'content_highlights',
    initialValue
  )
  return (
    <TrayShell
      reviewId={reviewId}
      blockKey="content_highlights"
      noteInitialValue={noteInitialValue}
    >
      <ProseField
        name="content_highlights"
        label="What resonated"
        hint="Two or three bullets (one per line, prefixed with '- ') describing the patterns behind the top posts."
        value={value}
        onChange={setValue}
        status={status}
        errorMessage={errorMessage}
        disabled={disabled}
      />
    </TrayShell>
  )
}

'use client'

import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'
import { BulletsField } from '@/components/reviews/editor/fields/bullets-field'
import { TrayShell } from './tray-shell'

type ProseSlideKey = 'initiatives' | 'takeaways' | 'planning'

// Editor-only copy. Not pulled from the slide registry because the registry
// owns the deck/renderer label, not the editor field hint.
const PROSE_COPY: Record<ProseSlideKey, { label: string; hint: string }> = {
  initiatives: {
    label: 'Initiatives',
    hint: 'What the team shipped or focused on this quarter, framed positively (≤ 150 words).',
  },
  takeaways: {
    label: 'Takeaways',
    hint: 'Two or three key lessons from the data. Plain-text bullets are fine (≤ 150 words).',
  },
  planning: {
    label: 'Planning ahead',
    hint: 'Forward-looking, opportunity-framed recommendations grounded in this quarter’s signals (≤ 150 words).',
  },
}

interface Props {
  reviewId: string
  slideKey: ProseSlideKey
  initialValue: string
  noteInitialValue: string | null
  disabled?: boolean
}

export function ProseTrayEditor({
  reviewId,
  slideKey,
  initialValue,
  noteInitialValue,
  disabled,
}: Props) {
  const { value, setValue, status, errorMessage } = useNarrativeBlockAutosave(
    reviewId,
    slideKey,
    initialValue
  )
  const { label, hint } = PROSE_COPY[slideKey]
  return (
    <TrayShell reviewId={reviewId} blockKey={slideKey} noteInitialValue={noteInitialValue}>
      <BulletsField
        name={slideKey}
        label={label}
        hint={hint}
        value={value}
        onChange={setValue}
        status={status}
        errorMessage={errorMessage}
        disabled={disabled}
      />
    </TrayShell>
  )
}

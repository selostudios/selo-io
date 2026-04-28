'use client'

import { Textarea } from '@/components/ui/textarea'
import type { NarrativeBlocks } from '@/lib/reviews/types'
import type { AutosaveStatus } from '@/components/reviews/editor/use-narrative-block-autosave'

/**
 * Re-export of {@link AutosaveStatus} kept for backward compatibility with
 * existing imports of `NarrativeFieldStatus`. New code should import
 * `AutosaveStatus` from the autosave hook directly.
 */
export type NarrativeFieldStatus = AutosaveStatus

export interface NarrativeFieldProps {
  /** Field id used for the label `htmlFor` and `data-testid` namespace. Must match a narrative block key. */
  name: keyof NarrativeBlocks
  /** Visible label rendered above the textarea. */
  label: string
  /** Optional helper text rendered between label and textarea. */
  hint?: string
  /** Current value; controlled by parent. */
  value: string
  /** Called on every keystroke. Parent owns debouncing/autosave. */
  onChange: (next: string) => void
  /** Optional save status — drives the indicator next to the label. Default: 'idle' (nothing rendered). */
  status?: AutosaveStatus
  /** Shown when `status === 'error'`. Falls back to "Save failed" when null/undefined. */
  errorMessage?: string | null
  /** Optional character limit; when provided, renders a "{value.length} / {limit}" counter under the textarea. */
  limit?: number
  /** When true, the textarea is read-only. Default: false. */
  disabled?: boolean
}

interface NarrativeFieldBaseProps extends NarrativeFieldProps {
  rows: number
  placeholder?: string
}

export function NarrativeFieldBase({
  name,
  label,
  hint,
  value,
  onChange,
  status = 'idle',
  errorMessage,
  limit,
  disabled = false,
  rows,
  placeholder,
}: NarrativeFieldBaseProps) {
  const inputId = `field-${name}`
  const hintId = `field-hint-${name}`
  const counterId = `field-counter-${name}`
  const hasHint = Boolean(hint)
  const hasCounter = typeof limit === 'number'
  const describedBy =
    [hasHint ? hintId : null, hasCounter ? counterId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-2" data-testid={`field-${name}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        {status !== 'idle' && (
          <span
            role="status"
            aria-live="polite"
            className={
              status === 'error' ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'
            }
            data-testid={`field-status-${name}`}
          >
            {status === 'saving' && 'Saving…'}
            {status === 'saved' && 'Saved'}
            {status === 'error' && (errorMessage ?? 'Save failed')}
          </span>
        )}
      </div>
      {hasHint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      <Textarea
        id={inputId}
        data-testid={`field-input-${name}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={describedBy}
      />
      {hasCounter && (
        <p
          id={counterId}
          className="text-muted-foreground text-xs"
          data-testid={`field-counter-${name}`}
        >
          {value.length} / {limit}
        </p>
      )}
    </div>
  )
}

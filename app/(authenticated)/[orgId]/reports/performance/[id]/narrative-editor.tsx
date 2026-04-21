'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { updateNarrative } from '@/lib/reviews/actions'
import type { NarrativeBlocks } from '@/lib/reviews/types'

type BlockKey = keyof NarrativeBlocks

interface BlockSpec {
  key: BlockKey
  label: string
  hint: string
  rows: number
}

const BLOCKS: BlockSpec[] = [
  {
    key: 'cover_subtitle',
    label: 'Cover subtitle',
    hint: 'One-liner capturing the quarter’s headline story (≤ 20 words).',
    rows: 2,
  },
  {
    key: 'ga_summary',
    label: 'Google Analytics summary',
    hint: 'Narrative over sessions, users, and engagement — call out the biggest deltas (≤ 120 words).',
    rows: 5,
  },
  {
    key: 'linkedin_insights',
    label: 'LinkedIn insights',
    hint: 'Follower growth, impression trends, top themes from top posts (≤ 120 words).',
    rows: 5,
  },
  {
    key: 'initiatives',
    label: 'Initiatives',
    hint: 'What the team shipped or focused on this quarter, framed positively (≤ 150 words).',
    rows: 6,
  },
  {
    key: 'takeaways',
    label: 'Takeaways',
    hint: 'Two or three key lessons from the data. Plain-text bullets are fine (≤ 150 words).',
    rows: 6,
  },
  {
    key: 'planning',
    label: 'Planning ahead',
    hint: 'Forward-looking, opportunity-framed recommendations grounded in this quarter’s signals (≤ 150 words).',
    rows: 6,
  },
]

const AUTOSAVE_DELAY_MS = 1500

interface Props {
  reviewId: string
  narrative: NarrativeBlocks
  aiOriginals: NarrativeBlocks
  canEdit: boolean
}

interface BlockState {
  value: string
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
}

function initialState(narrative: NarrativeBlocks): Record<BlockKey, BlockState> {
  const state = {} as Record<BlockKey, BlockState>
  for (const b of BLOCKS) {
    state[b.key] = {
      value: narrative[b.key] ?? '',
      status: 'idle',
      errorMessage: null,
    }
  }
  return state
}

export function NarrativeEditor({ reviewId, narrative, aiOriginals, canEdit }: Props) {
  const [state, setState] = useState(() => initialState(narrative))
  const timers = useRef<Partial<Record<BlockKey, ReturnType<typeof setTimeout>>>>({})

  useEffect(() => {
    const current = timers.current
    return () => {
      for (const key of Object.keys(current) as BlockKey[]) {
        const t = current[key]
        if (t) clearTimeout(t)
      }
    }
  }, [])

  const handleChange = (key: BlockKey, value: string) => {
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], value, status: 'idle', errorMessage: null },
    }))

    if (!canEdit) return

    const existing = timers.current[key]
    if (existing) clearTimeout(existing)

    timers.current[key] = setTimeout(async () => {
      setState((prev) => ({ ...prev, [key]: { ...prev[key], status: 'saving' } }))
      const result = await updateNarrative(reviewId, key, value)
      setState((prev) => ({
        ...prev,
        [key]: result.success
          ? { ...prev[key], status: 'saved', errorMessage: null }
          : { ...prev[key], status: 'error', errorMessage: result.error },
      }))
    }, AUTOSAVE_DELAY_MS)
  }

  return (
    <div className="space-y-8" data-testid="narrative-editor">
      {BLOCKS.map((block) => {
        const s = state[block.key]
        const original = aiOriginals[block.key] ?? ''
        const edited = original !== '' && s.value !== original
        return (
          <div key={block.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={`narrative-${block.key}`} className="text-sm font-medium">
                {block.label}
              </label>
              <div className="flex items-center gap-2 text-xs">
                {edited && (
                  <Badge variant="secondary" data-testid={`narrative-edited-badge-${block.key}`}>
                    Edited
                  </Badge>
                )}
                {s.status === 'saving' && (
                  <span
                    className="text-muted-foreground"
                    data-testid={`narrative-save-status-${block.key}`}
                  >
                    Saving…
                  </span>
                )}
                {s.status === 'saved' && (
                  <span
                    className="text-muted-foreground"
                    data-testid={`narrative-save-status-${block.key}`}
                  >
                    Saved
                  </span>
                )}
                {s.status === 'error' && (
                  <span
                    className="text-destructive"
                    data-testid={`narrative-save-status-${block.key}`}
                  >
                    {s.errorMessage ?? 'Save failed'}
                  </span>
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">{block.hint}</p>
            <Textarea
              id={`narrative-${block.key}`}
              data-testid={`narrative-editor-${block.key}`}
              value={s.value}
              onChange={(e) => handleChange(block.key, e.target.value)}
              rows={block.rows}
              disabled={!canEdit}
            />
          </div>
        )
      })}
    </div>
  )
}

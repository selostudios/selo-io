'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import type { NarrativeBlockKey } from '@/lib/reviews/narrative/prompts'
import { resetPromptOverride, savePromptOverrides } from '@/lib/reviews/narrative/settings-actions'

export interface PromptBlockView {
  key: NarrativeBlockKey
  label: string
  hint: string
  defaultTemplate: string
  override: string
}

interface Props {
  orgId: string
  blocks: PromptBlockView[]
}

export function PromptsForm({ orgId, blocks }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<Record<NarrativeBlockKey, string>>(() => {
    const init = {} as Record<NarrativeBlockKey, string>
    for (const b of blocks) init[b.key] = b.override
    return init
  })
  const [showDefaults, setShowDefaults] = useState<Record<NarrativeBlockKey, boolean>>(
    {} as Record<NarrativeBlockKey, boolean>
  )
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const [isPending, startTransition] = useTransition()
  const [resetPending, setResetPending] = useState<Record<NarrativeBlockKey, boolean>>(
    {} as Record<NarrativeBlockKey, boolean>
  )

  const handleSave = () => {
    setStatus({ kind: 'idle' })
    startTransition(async () => {
      const payload: Record<string, string> = {}
      for (const b of blocks) {
        const v = values[b.key]?.trim() ?? ''
        if (v.length > 0) payload[b.key] = v
      }
      const result = await savePromptOverrides(orgId, payload)
      if (result.success) {
        setStatus({ kind: 'saved' })
        router.refresh()
      } else {
        setStatus({ kind: 'error', message: result.error })
      }
    })
  }

  const handleReset = async (block: NarrativeBlockKey) => {
    setResetPending((p) => ({ ...p, [block]: true }))
    const result = await resetPromptOverride(orgId, block)
    setResetPending((p) => ({ ...p, [block]: false }))
    if (result.success) {
      setValues((v) => ({ ...v, [block]: '' }))
      setStatus({ kind: 'saved' })
      router.refresh()
    } else {
      setStatus({ kind: 'error', message: result.error })
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
      data-testid="performance-reports-settings-form"
      className="space-y-4"
    >
      {blocks.map((block) => (
        <div key={block.key} className="rounded-md border p-4">
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <label htmlFor={`prompt-${block.key}`} className="text-sm font-medium">
                {block.label}
              </label>
              <p className="text-muted-foreground text-xs">{block.hint}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleReset(block.key)}
              disabled={resetPending[block.key] || values[block.key].length === 0}
              data-testid={`prompt-reset-${block.key}`}
            >
              {resetPending[block.key] ? 'Resetting…' : 'Reset to default'}
            </Button>
          </div>

          <Textarea
            id={`prompt-${block.key}`}
            data-testid={`prompt-override-${block.key}`}
            value={values[block.key]}
            onChange={(e) => setValues((v) => ({ ...v, [block.key]: e.target.value }))}
            rows={6}
            placeholder="Leave empty to use the default prompt."
          />

          <Collapsible
            open={showDefaults[block.key] ?? false}
            onOpenChange={(open) => setShowDefaults((s) => ({ ...s, [block.key]: open }))}
          >
            <CollapsibleTrigger className="text-muted-foreground mt-2 text-xs underline-offset-2 hover:underline">
              {showDefaults[block.key] ? 'Hide default' : 'Show default'}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="bg-muted text-muted-foreground mt-2 rounded-md p-3 text-xs whitespace-pre-wrap">
                {block.defaultTemplate}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}

      <div className="bg-background sticky bottom-0 flex items-center justify-between border-t pt-4">
        <div className="text-xs">
          {status.kind === 'saved' && <span className="text-muted-foreground">Saved</span>}
          {status.kind === 'error' && <span className="text-destructive">{status.message}</span>}
        </div>
        <Button type="submit" disabled={isPending} data-testid="performance-reports-settings-save">
          {isPending ? 'Saving…' : 'Save all changes'}
        </Button>
      </div>
    </form>
  )
}

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MAX_MEMO_CHARS } from '@/lib/reviews/narrative/style-memo-shared'
import {
  clearStyleMemo,
  regenerateStyleMemoFromLatestSnapshot,
  saveStyleMemo,
} from '@/lib/reviews/narrative/style-memo-actions'

interface Props {
  orgId: string
  memo: string
  source: 'auto' | 'manual'
  updatedAt: string | null
  updatedByName: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Metadata({
  memo,
  source,
  updatedAt,
  updatedByName,
}: {
  memo: string
  source: 'auto' | 'manual'
  updatedAt: string | null
  updatedByName: string | null
}) {
  if (!memo.trim()) {
    return (
      <p className="text-muted-foreground text-xs">
        No style learned yet — publish your first report and Claude will start here.
      </p>
    )
  }

  const formatted = formatDate(updatedAt)

  if (source === 'auto') {
    return (
      <p className="text-muted-foreground text-xs">
        Auto-updated{formatted ? ` ${formatted}` : ''}
      </p>
    )
  }

  const name = updatedByName ?? 'an admin'
  return (
    <p className="text-muted-foreground text-xs">
      Edited by {name}
      {formatted ? ` on ${formatted}` : ''}
    </p>
  )
}

export function StyleMemoCard({ orgId, memo, source, updatedAt, updatedByName }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(memo)
  const [initialMemo, setInitialMemo] = useState(memo)
  const [saveStatus, setSaveStatus] = useState<
    { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const [regenStatus, setRegenStatus] = useState<
    { kind: 'idle' } | { kind: 'ok' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const [clearError, setClearError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [isRegenerating, startRegen] = useTransition()
  const [isClearing, startClear] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const dirty = value !== initialMemo
  const isEmpty = value.trim().length === 0

  // Resync local state when the server-provided memo prop changes (e.g. after
  // router.refresh() following a regenerate or clear). Only overwrite the
  // textarea value if the user has no unsaved edits — otherwise we'd clobber
  // work in progress.
  useEffect(() => {
    setValue((prev) => (prev === initialMemo ? memo : prev))
    setInitialMemo(memo)
    // initialMemo is read above to detect dirty state; tracking only `memo`
    // is intentional so this effect fires on prop changes, not on local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memo])

  const handleSave = () => {
    setSaveStatus({ kind: 'idle' })
    startSave(async () => {
      const result = await saveStyleMemo(orgId, value)
      if (result.success) {
        setInitialMemo(value)
        setSaveStatus({ kind: 'saved' })
      } else {
        setSaveStatus({ kind: 'error', message: result.error })
      }
    })
  }

  const handleRegenerate = () => {
    setRegenStatus({ kind: 'idle' })
    startRegen(async () => {
      const result = await regenerateStyleMemoFromLatestSnapshot(orgId)
      if (result.success) {
        setRegenStatus({ kind: 'ok' })
        router.refresh()
      } else {
        setRegenStatus({ kind: 'error', message: result.error })
      }
    })
  }

  const handleClearConfirm = () => {
    setClearError(null)
    startClear(async () => {
      const result = await clearStyleMemo(orgId)
      if (result.success) {
        setValue('')
        setInitialMemo('')
        setConfirmOpen(false)
        router.refresh()
      } else {
        setClearError(result.error)
      }
    })
  }

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-lg border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/60 p-5 shadow-sm dark:border-indigo-500/30 dark:from-indigo-950/30 dark:via-slate-950 dark:to-purple-950/30"
      data-testid="style-memo-card"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600"
      />
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950 dark:text-indigo-100">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Learned style memo
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Claude updates this after each publish.
          </p>
        </div>

        <Metadata
          memo={value}
          source={source}
          updatedAt={updatedAt}
          updatedByName={updatedByName}
        />

        <Textarea
          data-testid="style-memo-textarea"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setSaveStatus({ kind: 'idle' })
            setRegenStatus({ kind: 'idle' })
          }}
          rows={10}
          maxLength={MAX_MEMO_CHARS}
          placeholder="Claude will fill this in after your first publish. You can also paste in your own notes."
          className="border-indigo-200 bg-white/80 placeholder:text-indigo-400/70 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/30 dark:border-indigo-500/30 dark:bg-slate-950/60 dark:placeholder:text-indigo-300/40 dark:focus-visible:border-indigo-400"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !dirty}
            data-testid="style-memo-save-button"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
          {saveStatus.kind === 'saved' && (
            <span
              className="text-xs text-indigo-700 dark:text-indigo-300"
              data-testid="style-memo-save-status"
            >
              Saved
            </span>
          )}
          {saveStatus.kind === 'error' && (
            <span className="text-destructive text-xs" data-testid="style-memo-save-status">
              {saveStatus.message}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            data-testid="style-memo-regenerate-button"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              'Regenerate from last snapshot'
            )}
          </Button>
          {regenStatus.kind === 'ok' && (
            <span
              className="text-xs text-indigo-700 dark:text-indigo-300"
              data-testid="style-memo-regen-status"
            >
              Regenerated
            </span>
          )}
          {regenStatus.kind === 'error' && (
            <span className="text-destructive text-xs" data-testid="style-memo-regen-status">
              {regenStatus.message}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setClearError(null)
              setConfirmOpen(true)
            }}
            disabled={isEmpty || isClearing}
            data-testid="style-memo-clear-button"
          >
            Clear memo
          </Button>
        </div>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!isClearing) setConfirmOpen(next)
        }}
      >
        <AlertDialogContent data-testid="style-memo-clear-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the learned style memo?</AlertDialogTitle>
            <AlertDialogDescription>
              Claude will rebuild from your next publish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {clearError && (
            <p className="text-destructive text-sm" data-testid="style-memo-clear-error">
              {clearError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleClearConfirm()
              }}
              disabled={isClearing}
              data-testid="style-memo-clear-confirm"
            >
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing…
                </>
              ) : (
                'Clear memo'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

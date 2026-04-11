'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { runAIVisibilitySync } from '@/app/(authenticated)/[orgId]/ai-visibility/actions'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

interface SyncButtonProps {
  orgId: string
  lastSyncAt?: string | null
  isInternal?: boolean
  disabled?: boolean
}

export function SyncButton({
  orgId,
  lastSyncAt,
  isInternal = false,
  disabled = false,
}: SyncButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [lastSync, setLastSync] = useState(lastSyncAt)
  const router = useRouter()

  const handleSync = () => {
    startTransition(async () => {
      const result = await runAIVisibilitySync(orgId)

      if (!('success' in result) || !result.success) {
        const errorMsg = 'error' in result ? result.error : 'Sync failed'
        const isNotConfigured = errorMsg.includes('not configured')
        toast.error(errorMsg, {
          action:
            isNotConfigured && isInternal
              ? {
                  label: 'Go to Settings',
                  onClick: () => router.push(`/${orgId}/settings/integrations`),
                }
              : undefined,
        })
        return
      }

      const skipped =
        'skippedPlatforms' in result && result.skippedPlatforms.length > 0
          ? ` (${result.skippedPlatforms.join(', ')} skipped — no API key)`
          : ''
      const errorMessages =
        'errorMessages' in result && (result.errorMessages as string[]).length > 0
          ? result.errorMessages
          : []
      if ((errorMessages as string[]).length > 0) {
        toast.warning(
          `Sync partially complete: ${result.queriesCompleted} queries run, ${(errorMessages as string[]).length} failed` +
            skipped,
          { description: (errorMessages as string[])[0] }
        )
      } else {
        toast.success(
          `Sync complete: ${result.queriesCompleted} queries run` +
            (result.budgetExceeded ? ' (budget limit reached)' : '') +
            skipped
        )
      }
      setLastSync(new Date().toISOString())
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleSync} disabled={isPending || disabled} variant="outline" size="sm">
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Sync Now
      </Button>
      {lastSync && (
        <span className="text-muted-foreground text-xs">
          Last synced{' '}
          {new Date(lastSync).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      )}
    </div>
  )
}

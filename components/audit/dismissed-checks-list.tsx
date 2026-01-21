'use client'

import { useState, useEffect } from 'react'
import { Flag, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import type { DismissedCheck } from '@/lib/audit/types'

function formatCheckName(checkName: string): string {
  return checkName
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname || '/'
  } catch {
    return url
  }
}

export function DismissedChecksList() {
  const [dismissedChecks, setDismissedChecks] = useState<DismissedCheck[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/audit/dismiss')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDismissedChecks(data)
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('[Fetch Dismissed Checks Error]', err)
        setIsLoading(false)
      })
  }, [])

  const handleRestore = async (id: string) => {
    setRestoringIds((prev) => new Set([...prev, id]))

    try {
      const response = await fetch(`/api/audit/dismiss?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setDismissedChecks((prev) => prev.filter((d) => d.id !== id))
      }
    } finally {
      setRestoringIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-4">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading...
      </div>
    )
  }

  if (dismissedChecks.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title="No dismissed checks"
        description="Checks you flag as not applicable will appear here."
      />
    )
  }

  // Group by check name
  const groupedByCheck = dismissedChecks.reduce(
    (acc, check) => {
      if (!acc[check.check_name]) {
        acc[check.check_name] = []
      }
      acc[check.check_name].push(check)
      return acc
    },
    {} as Record<string, DismissedCheck[]>
  )

  return (
    <div className="space-y-3">
      {Object.entries(groupedByCheck).map(([checkName, checks]) => (
        <div key={checkName} className="rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-2">
            <Flag className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">{formatCheckName(checkName)}</span>
            <span className="text-muted-foreground text-xs">
              ({checks.length} {checks.length === 1 ? 'page' : 'pages'})
            </span>
          </div>
          <div className="space-y-1">
            {checks.map((check) => (
              <div
                key={check.id}
                className="bg-muted/30 flex items-center justify-between rounded px-3 py-1.5"
              >
                <span className="text-muted-foreground truncate text-xs" title={check.url}>
                  {formatUrl(check.url)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => handleRestore(check.id)}
                  disabled={restoringIds.has(check.id)}
                >
                  {restoringIds.has(check.id) ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="mr-1 size-3" />
                      Restore
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

'use client'

import { useState, type ReactNode, type KeyboardEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Organization {
  id: string
  websiteUrl: string
}

interface AuditRunControlProps {
  /** Title for one-time mode */
  title: string
  /** Description for one-time mode */
  description: string
  /** If provided, shows organization URL mode instead of one-time input */
  organization?: Organization | null
  /** Callback when Run Audit is clicked, receives URL and optional organizationId */
  onRunAudit: (url: string, organizationId?: string) => Promise<void>
  /** Whether an audit is currently running */
  isRunning?: boolean
  /** Additional controls to render below the header (e.g., SampleSizeSelector) */
  children?: ReactNode
}

/**
 * Reusable component for starting audits in both Page Speed and AIO views.
 *
 * Two modes:
 * - Organization mode (when `organization` prop provided): Shows org URL as title, "Organization URL" as description
 * - One-time mode (when no organization): Shows configurable title/description with URL input field
 */
export function AuditRunControl({
  title,
  description,
  organization,
  onRunAudit,
  isRunning = false,
  children,
}: AuditRunControlProps) {
  const [oneTimeUrl, setOneTimeUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRunAudit = async () => {
    setError(null)

    let url: string
    let organizationId: string | undefined

    if (organization) {
      url = organization.websiteUrl
      organizationId = organization.id
    } else {
      if (!oneTimeUrl.trim()) return

      url = oneTimeUrl.trim()
      // Auto-prepend https:// if no protocol specified
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
    }

    try {
      await onRunAudit(url, organizationId)
      // Clear input on success for one-time mode
      if (!organization) {
        setOneTimeUrl('')
      }
    } catch (err) {
      console.error('[AuditRunControl] Failed to start audit:', err)
      setError(err instanceof Error ? err.message : 'Failed to start audit')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && oneTimeUrl.trim() && !isRunning) {
      handleRunAudit()
    }
  }

  const isDisabled = organization ? isRunning : !oneTimeUrl.trim() || isRunning

  return (
    <Card>
      <CardHeader>
        {organization ? (
          // Organization mode: URL as title with button right-aligned
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{organization.websiteUrl}</CardTitle>
              <CardDescription>Organization URL</CardDescription>
            </div>
            <Button onClick={handleRunAudit} disabled={isDisabled}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  Running...
                </>
              ) : (
                'Run Audit'
              )}
            </Button>
          </div>
        ) : (
          // One-time mode: Title, input field, and button right-aligned
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="url"
                placeholder="https://example.com"
                className="w-64"
                value={oneTimeUrl}
                onChange={(e) => setOneTimeUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isRunning}
                autoComplete="url"
                aria-label="Website URL"
              />
              <Button onClick={handleRunAudit} disabled={isDisabled}>
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                    Running...
                  </>
                ) : (
                  'Run Audit'
                )}
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p className="text-destructive mt-2 text-sm" role="alert" aria-live="polite">
            {error}
          </p>
        )}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}

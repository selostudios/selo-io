'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notifyAuditStarted } from '@/hooks/use-active-audit'

export function QuickAuditClient() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRunAudit = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    try {
      new URL(normalizedUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/unified-audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl, organizationId: null }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start audit')
      }

      const data = await response.json()
      notifyAuditStarted()
      router.push(`/seo/audit/${data.auditId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-neutral-500" />
            <CardTitle className="text-base">Run Full Site Audit</CardTitle>
          </div>
          <CardDescription>
            Comprehensive analysis covering SEO, Performance, and AI Readiness in a single audit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="url" className="sr-only">
                URL
              </Label>
              <Input
                id="url"
                data-testid="quick-audit-url-input"
                placeholder="example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim()) {
                    e.preventDefault()
                    handleRunAudit()
                  }
                }}
              />
            </div>
            <Button
              data-testid="quick-audit-run-button"
              onClick={handleRunAudit}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Run Audit'
              )}
            </Button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600" data-testid="quick-audit-error">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

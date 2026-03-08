'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSearch, Gauge, Sparkles, Loader2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AuditType = 'site-audit' | 'page-speed' | 'aio'

const auditTypes = [
  {
    id: 'site-audit' as AuditType,
    name: 'SEO Audit',
    description: 'Comprehensive site crawl checking SEO, AI-readiness, and technical issues',
    icon: FileSearch,
  },
  {
    id: 'page-speed' as AuditType,
    name: 'Page Speed',
    description: 'Core Web Vitals and performance analysis via PageSpeed Insights',
    icon: Gauge,
  },
  {
    id: 'aio' as AuditType,
    name: 'AI Optimization',
    description: 'Check how well your site is optimized for AI search engines',
    icon: Sparkles,
  },
]

export function QuickAuditClient() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState<AuditType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRunAudit = async (type: AuditType) => {
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

    setLoading(type)
    setError(null)

    try {
      let endpoint: string
      let body: Record<string, unknown>
      let redirectPath: string

      switch (type) {
        case 'site-audit':
          endpoint = '/api/audit/start'
          body = { url: normalizedUrl }
          redirectPath = '/seo/site-audit'
          break
        case 'page-speed':
          endpoint = '/api/performance/start'
          body = { urls: [normalizedUrl] }
          redirectPath = '/seo/page-speed'
          break
        case 'aio':
          endpoint = '/api/aio/audit/start'
          body = { url: normalizedUrl, organizationId: null, sampleSize: 5 }
          redirectPath = '/seo/aio'
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start audit')
      }

      const data = await response.json()
      const auditId = data.auditId

      // Navigate to the audit detail page
      router.push(`${redirectPath}/${auditId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audit')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Website URL</CardTitle>
          <CardDescription>Enter the URL you want to audit</CardDescription>
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
                  if (e.key === 'Enter') {
                    e.preventDefault()
                  }
                }}
              />
            </div>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600" data-testid="quick-audit-error">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Audit Type Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {auditTypes.map((audit) => {
          const Icon = audit.icon
          const isLoading = loading === audit.id
          const isDisabled = loading !== null

          return (
            <Card
              key={audit.id}
              className="flex flex-col"
              data-testid={`quick-audit-${audit.id}-card`}
            >
              <CardHeader className="flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-neutral-500" />
                  <CardTitle className="text-base">{audit.name}</CardTitle>
                </div>
                <CardDescription className="text-sm">{audit.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  data-testid={`quick-audit-${audit.id}-button`}
                  onClick={() => handleRunAudit(audit.id)}
                  disabled={isDisabled || !url.trim()}
                  className="w-full"
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Run Audit
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportPresentation } from '@/components/reports/report-presentation'
import { AuditReport } from '@/components/audit/audit-report'
import { accessSharedLink } from '@/lib/share/actions'
import { getSharedReportData, getSharedSiteAuditData } from './actions'
import { getShareErrorMessage, getResourceTypeLabel } from '@/lib/share/utils'
import { SharedResourceType } from '@/lib/enums'
import type { ReportPresentationData } from '@/lib/reports/types'
import type { SharedSiteAuditData } from './actions'

interface SharedResourceClientProps {
  token: string
  resourceType: SharedResourceType
  requiresPassword: boolean
}

type ResourceData =
  | { type: 'report'; data: ReportPresentationData }
  | { type: 'site_audit'; data: SharedSiteAuditData }

export function SharedResourceClient({
  token,
  resourceType,
  requiresPassword,
}: SharedResourceClientProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(!requiresPassword)
  const [error, setError] = useState<string | null>(null)
  const [resourceData, setResourceData] = useState<ResourceData | null>(null)

  const label = getResourceTypeLabel(resourceType)

  const loadResource = useCallback(
    async (providedPassword?: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await accessSharedLink(token, providedPassword)

        if (!result.success) {
          const errorMessage = result.errorCode
            ? getShareErrorMessage(result.errorCode)
            : 'Unable to access this resource'
          setError(errorMessage)
          setIsLoading(false)
          return
        }

        // Fetch resource-specific data based on type
        switch (result.resource_type) {
          case SharedResourceType.Report: {
            const reportData = await getSharedReportData(result.resource_id!)
            if (!reportData) {
              setError('Failed to load report data')
              setIsLoading(false)
              return
            }
            setResourceData({ type: 'report', data: reportData })
            break
          }
          case SharedResourceType.SiteAudit: {
            const auditData = await getSharedSiteAuditData(result.resource_id!)
            if (!auditData) {
              setError('Failed to load audit data')
              setIsLoading(false)
              return
            }
            setResourceData({ type: 'site_audit', data: auditData })
            break
          }
          default:
            setError('Unsupported resource type')
            setIsLoading(false)
            return
        }
      } catch {
        setError('Failed to load resource')
      } finally {
        setIsLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (!requiresPassword) {
      loadResource()
    }
  }, [requiresPassword, loadResource])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.trim()) {
      loadResource(password)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-muted-foreground mt-4">Loading {label.toLowerCase()}...</p>
        </div>
      </div>
    )
  }

  // Password entry
  if (requiresPassword && !resourceData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <Lock className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle>Password Required</CardTitle>
            <CardDescription>
              This {label.toLowerCase()} is password protected. Enter the password to view it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!password.trim()}>
                View {label}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error && !resourceData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-md px-4 text-center">
          <div className="mb-6 text-6xl">⚠️</div>
          <h1 className="mb-4 text-2xl font-bold">Unable to Load {label}</h1>
          <p className="text-muted-foreground mb-8">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  // Render the resource
  if (resourceData) {
    switch (resourceData.type) {
      case 'report':
        return <ReportPresentation data={resourceData.data} isPublic />
      case 'site_audit':
        return (
          <div className="p-6">
            <AuditReport
              audit={resourceData.data.audit}
              checks={resourceData.data.checks}
              pages={resourceData.data.pages}
              isPublic
            />
          </div>
        )
    }
  }

  return null
}

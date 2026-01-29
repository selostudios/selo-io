'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportPresentation } from '@/components/reports/report-presentation'
import { accessSharedReport } from '@/app/(authenticated)/seo/reports/share-actions'
import { getSharedReportPresentationData } from './actions'
import { getShareErrorMessage } from '@/lib/reports/types'
import type { ReportPresentationData } from '@/lib/reports/types'

interface PublicReportClientProps {
  token: string
  requiresPassword: boolean
}

export function PublicReportClient({ token, requiresPassword }: PublicReportClientProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(!requiresPassword)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportPresentationData | null>(null)

  const loadReport = useCallback(
    async (providedPassword?: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await accessSharedReport(token, providedPassword)

        if (!result.success) {
          const errorMessage = result.errorCode
            ? getShareErrorMessage(result.errorCode)
            : 'Unable to access this report'
          setError(errorMessage)
          setIsLoading(false)
          return
        }

        // Get full presentation data using server action
        const presentationData = await getSharedReportPresentationData(result.report!.id)
        if (!presentationData) {
          setError('Failed to load report data')
          setIsLoading(false)
          return
        }

        setReportData(presentationData)
      } catch {
        setError('Failed to load report')
      } finally {
        setIsLoading(false)
      }
    },
    [token]
  )

  // Auto-load if no password required
  useEffect(() => {
    if (!requiresPassword) {
      loadReport()
    }
  }, [requiresPassword, loadReport])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.trim()) {
      loadReport(password)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-muted-foreground mt-4">Loading report...</p>
        </div>
      </div>
    )
  }

  // Password entry
  if (requiresPassword && !reportData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <Lock className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle>Password Required</CardTitle>
            <CardDescription>
              This report is password protected. Enter the password to view it.
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
                View Report
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error && !reportData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-md px-4 text-center">
          <div className="mb-6 text-6xl">⚠️</div>
          <h1 className="mb-4 text-2xl font-bold">Unable to Load Report</h1>
          <p className="text-muted-foreground mb-8">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  // Report presentation
  if (reportData) {
    return <ReportPresentation data={reportData} isPublic />
  }

  return null
}

'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  FileSearch,
  Gauge,
  Bot,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { SiteAudit } from '@/lib/audit/types'
import type { PerformanceAudit } from '@/lib/performance/types'
import type { AIOAudit } from '@/lib/aio/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import { createReport, validateAuditsForReport } from '../actions'
import { extractDomain, getScoreStatus, getScoreBadgeVariant } from '@/lib/reports'
import type { ReportValidationResult } from '@/lib/reports/types'

interface NewReportClientProps {
  siteAudits: SiteAudit[]
  performanceAudits: (PerformanceAudit & { domain: string | null })[]
  aioAudits: AIOAudit[]
  inProgressSiteAudits: SiteAudit[]
  inProgressPerformanceAudits: (PerformanceAudit & { domain: string | null })[]
  inProgressAioAudits: AIOAudit[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
  preselectedDomain: string | null
}

export function NewReportClient({
  siteAudits,
  performanceAudits,
  aioAudits,
  inProgressSiteAudits,
  inProgressPerformanceAudits,
  inProgressAioAudits,
  selectedOrganizationId,
  preselectedDomain,
}: NewReportClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState(preselectedDomain ?? '')
  const [selectedSiteAudit, setSelectedSiteAudit] = useState<SiteAudit | null>(null)
  const [selectedPerfAudit, setSelectedPerfAudit] = useState<
    (PerformanceAudit & { domain: string | null }) | null
  >(null)
  const [selectedAioAudit, setSelectedAioAudit] = useState<AIOAudit | null>(null)
  const [validation, setValidation] = useState<ReportValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter audits by search query (domain)
  const filteredSiteAudits = useMemo(() => {
    if (!searchQuery.trim()) return siteAudits
    const query = searchQuery.toLowerCase()
    return siteAudits.filter((a) => extractDomain(a.url).includes(query))
  }, [siteAudits, searchQuery])

  const filteredInProgressSiteAudits = useMemo(() => {
    if (!searchQuery.trim()) return inProgressSiteAudits
    const query = searchQuery.toLowerCase()
    return inProgressSiteAudits.filter((a) => extractDomain(a.url).includes(query))
  }, [inProgressSiteAudits, searchQuery])

  const filteredPerfAudits = useMemo(() => {
    if (!searchQuery.trim()) return performanceAudits
    const query = searchQuery.toLowerCase()
    return performanceAudits.filter((a) => a.domain?.includes(query))
  }, [performanceAudits, searchQuery])

  const filteredInProgressPerfAudits = useMemo(() => {
    if (!searchQuery.trim()) return inProgressPerformanceAudits
    const query = searchQuery.toLowerCase()
    return inProgressPerformanceAudits.filter((a) => a.domain?.includes(query))
  }, [inProgressPerformanceAudits, searchQuery])

  const filteredAioAudits = useMemo(() => {
    if (!searchQuery.trim()) return aioAudits
    const query = searchQuery.toLowerCase()
    return aioAudits.filter((a) => extractDomain(a.url).includes(query))
  }, [aioAudits, searchQuery])

  const filteredInProgressAioAudits = useMemo(() => {
    if (!searchQuery.trim()) return inProgressAioAudits
    const query = searchQuery.toLowerCase()
    return inProgressAioAudits.filter((a) => extractDomain(a.url).includes(query))
  }, [inProgressAioAudits, searchQuery])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getScoreBadge = (score: number | null) => {
    if (score === null) return null
    const status = getScoreStatus(score)
    const variant = getScoreBadgeVariant(status)
    return (
      <Badge variant={variant} className="font-mono text-xs">
        {score}
      </Badge>
    )
  }

  // Validate when all three audits are selected
  const handleValidate = async () => {
    if (!selectedSiteAudit || !selectedPerfAudit || !selectedAioAudit) return

    setIsValidating(true)
    setError(null)

    try {
      const result = await validateAuditsForReport(
        selectedSiteAudit.id,
        selectedPerfAudit.id,
        selectedAioAudit.id
      )
      setValidation(result)
    } catch {
      setError('Failed to validate audits')
    } finally {
      setIsValidating(false)
    }
  }

  const handleCreateReport = async () => {
    if (!selectedSiteAudit || !selectedPerfAudit || !selectedAioAudit) return

    setIsCreating(true)
    setError(null)

    try {
      const result = await createReport({
        site_audit_id: selectedSiteAudit.id,
        performance_audit_id: selectedPerfAudit.id,
        aio_audit_id: selectedAioAudit.id,
      })

      if (result.success && result.reportId) {
        router.push(`/seo/reports/${result.reportId}`)
      } else {
        setError(result.error ?? 'Failed to create report')
      }
    } catch {
      setError('Failed to create report')
    } finally {
      setIsCreating(false)
    }
  }

  const allSelected = selectedSiteAudit && selectedPerfAudit && selectedAioAudit
  const canCreate = allSelected && validation?.is_valid

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/seo/reports">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="new-report-page-title">
            New Report
          </h1>
          <p className="text-muted-foreground mt-1">
            Select one audit from each category to create a consolidated report
          </p>
        </div>
      </div>

      {/* Search - only show for one-time audits (no organization selected) */}
      {!selectedOrganizationId && (
        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Filter by domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Audit Selection Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* SEO Audit Selection */}
        <Card data-testid="seo-audit-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              SEO Audit
            </CardTitle>
            <CardDescription>Select a completed site audit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredSiteAudits.length === 0 && filteredInProgressSiteAudits.length === 0 ? (
              <EmptyState
                icon={FileSearch}
                title="No SEO audits"
                description="Run a site audit first"
                className="py-4"
              />
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {/* In-progress audits (shown first, disabled) */}
                {filteredInProgressSiteAudits.map((audit) => (
                  <div
                    key={audit.id}
                    className="w-full cursor-not-allowed rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 opacity-70"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-neutral-500">
                        {extractDomain(audit.url)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                        <Badge variant="outline" className="text-xs">
                          In Progress
                        </Badge>
                      </div>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {formatDate(audit.created_at)}
                    </div>
                  </div>
                ))}
                {/* Completed audits (selectable) */}
                {filteredSiteAudits.map((audit) => (
                  <button
                    key={audit.id}
                    onClick={() => {
                      setSelectedSiteAudit(audit)
                      setValidation(null)
                    }}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selectedSiteAudit?.id === audit.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">
                        {extractDomain(audit.url)}
                      </span>
                      {getScoreBadge(audit.overall_score)}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {formatDate(audit.created_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PageSpeed Audit Selection */}
        <Card data-testid="pagespeed-audit-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              PageSpeed Audit
            </CardTitle>
            <CardDescription>Select a completed performance audit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredPerfAudits.length === 0 && filteredInProgressPerfAudits.length === 0 ? (
              <EmptyState
                icon={Gauge}
                title="No PageSpeed audits"
                description="Run a performance audit first"
                className="py-4"
              />
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {/* In-progress audits (shown first, disabled) */}
                {filteredInProgressPerfAudits.map((audit) => (
                  <div
                    key={audit.id}
                    className="w-full cursor-not-allowed rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 opacity-70"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-neutral-500">
                        {audit.domain ?? 'Unknown domain'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                        <Badge variant="outline" className="text-xs">
                          In Progress
                        </Badge>
                      </div>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {formatDate(audit.created_at)}
                    </div>
                  </div>
                ))}
                {/* Completed audits (selectable) */}
                {filteredPerfAudits.map((audit) => (
                  <button
                    key={audit.id}
                    onClick={() => {
                      setSelectedPerfAudit(audit)
                      setValidation(null)
                    }}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selectedPerfAudit?.id === audit.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">
                        {audit.domain ?? 'Unknown domain'}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {formatDate(audit.created_at)} · {audit.completed_count} URLs
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AIO Audit Selection */}
        <Card data-testid="aio-audit-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AIO Audit
            </CardTitle>
            <CardDescription>Select a completed AI optimization audit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredAioAudits.length === 0 && filteredInProgressAioAudits.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="No AIO audits"
                description="Run an AIO audit first"
                className="py-4"
              />
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {/* In-progress audits (shown first, disabled) */}
                {filteredInProgressAioAudits.map((audit) => (
                  <div
                    key={audit.id}
                    className="w-full cursor-not-allowed rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 opacity-70"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-neutral-500">
                        {extractDomain(audit.url)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                        <Badge variant="outline" className="text-xs">
                          In Progress
                        </Badge>
                      </div>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {formatDate(audit.created_at)}
                    </div>
                  </div>
                ))}
                {/* Completed audits (selectable) */}
                {filteredAioAudits.map((audit) => (
                  <button
                    key={audit.id}
                    onClick={() => {
                      setSelectedAioAudit(audit)
                      setValidation(null)
                    }}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selectedAioAudit?.id === audit.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">
                        {extractDomain(audit.url)}
                      </span>
                      {getScoreBadge(audit.overall_aio_score)}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {formatDate(audit.created_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validation & Create Section */}
      {allSelected && (
        <Card>
          <CardContent className="pt-6">
            {/* Validation Errors/Warnings */}
            {validation && !validation.is_valid && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Cannot create report</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-inside list-disc">
                    {validation.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation?.warnings && validation.warnings.length > 0 && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-inside list-disc">
                    {validation.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation?.is_valid && (
              <Alert className="mb-4 border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                <Check className="h-4 w-4" />
                <AlertTitle>Ready to create report</AlertTitle>
                <AlertDescription>
                  All audits are valid and can be combined into a report.
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
              {!validation && (
                <Button
                  onClick={handleValidate}
                  disabled={isValidating}
                  data-testid="validate-selection-button"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Validate Selection'
                  )}
                </Button>
              )}

              {validation && (
                <Button
                  onClick={handleCreateReport}
                  disabled={!canCreate || isCreating}
                  data-testid="create-report-button"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Report...
                    </>
                  ) : (
                    'Create Report'
                  )}
                </Button>
              )}
            </div>

            {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Selection Summary */}
      {!allSelected && (
        <Card data-testid="selection-instructions">
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-center text-sm">
              Select one audit from each category above to create a consolidated report.
              <br />
              All audits must be for the same domain and within 7 days of each other.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

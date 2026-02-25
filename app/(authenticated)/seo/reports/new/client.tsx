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
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AuditSelectionCard, type AuditItem } from '@/components/reports/audit-selection-card'
import type { SiteAudit } from '@/lib/audit/types'
import type { PerformanceAudit } from '@/lib/performance/types'
import type { AIOAudit } from '@/lib/aio/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import { createReport, validateAuditsForReport } from '../actions'
import { extractDomain } from '@/lib/reports'
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
  const [selectedSiteAuditId, setSelectedSiteAuditId] = useState<string | null>(null)
  const [selectedPerfAuditId, setSelectedPerfAuditId] = useState<string | null>(null)
  const [selectedAioAuditId, setSelectedAioAuditId] = useState<string | null>(null)
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

  // Transform audits to AuditItem format
  const siteAuditItems: AuditItem[] = useMemo(
    () =>
      filteredSiteAudits.map((a) => ({
        id: a.id,
        domain: extractDomain(a.url),
        date: a.created_at,
        score: a.overall_score,
      })),
    [filteredSiteAudits]
  )

  const inProgressSiteItems: AuditItem[] = useMemo(
    () =>
      filteredInProgressSiteAudits.map((a) => ({
        id: a.id,
        domain: extractDomain(a.url),
        date: a.created_at,
      })),
    [filteredInProgressSiteAudits]
  )

  const perfAuditItems: AuditItem[] = useMemo(
    () =>
      filteredPerfAudits.map((a) => ({
        id: a.id,
        domain: a.domain ?? 'Unknown domain',
        date: a.created_at,
        score: a.avg_performance_score ?? null,
        subtitle: `${a.completed_count} URLs`,
      })),
    [filteredPerfAudits]
  )

  const inProgressPerfItems: AuditItem[] = useMemo(
    () =>
      filteredInProgressPerfAudits.map((a) => ({
        id: a.id,
        domain: a.domain ?? 'Unknown domain',
        date: a.created_at,
      })),
    [filteredInProgressPerfAudits]
  )

  const aioAuditItems: AuditItem[] = useMemo(
    () =>
      filteredAioAudits.map((a) => ({
        id: a.id,
        domain: extractDomain(a.url),
        date: a.created_at,
        score: a.overall_aio_score,
      })),
    [filteredAioAudits]
  )

  const inProgressAioItems: AuditItem[] = useMemo(
    () =>
      filteredInProgressAioAudits.map((a) => ({
        id: a.id,
        domain: extractDomain(a.url),
        date: a.created_at,
      })),
    [filteredInProgressAioAudits]
  )

  // Validate when all three audits are selected
  const handleValidate = async () => {
    if (!selectedSiteAuditId || !selectedPerfAuditId || !selectedAioAuditId) return

    setIsValidating(true)
    setError(null)

    try {
      const result = await validateAuditsForReport(
        selectedSiteAuditId,
        selectedPerfAuditId,
        selectedAioAuditId
      )
      setValidation(result)
    } catch {
      setError('Failed to validate audits')
    } finally {
      setIsValidating(false)
    }
  }

  const handleCreateReport = async () => {
    if (!selectedSiteAuditId || !selectedPerfAuditId || !selectedAioAuditId) return

    setIsCreating(true)
    setError(null)

    try {
      const result = await createReport({
        site_audit_id: selectedSiteAuditId,
        performance_audit_id: selectedPerfAuditId,
        aio_audit_id: selectedAioAuditId,
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

  const handleSelect = (setter: (id: string | null) => void, id: string) => {
    setter(id)
    setValidation(null)
  }

  const allSelected = selectedSiteAuditId && selectedPerfAuditId && selectedAioAuditId
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
        <AuditSelectionCard
          icon={FileSearch}
          title="SEO Audit"
          description="Select a completed site audit"
          emptyTitle="No SEO audits"
          emptyDescription="Run a site audit first"
          audits={siteAuditItems}
          inProgressAudits={inProgressSiteItems}
          selectedId={selectedSiteAuditId}
          onSelect={(id) => handleSelect(setSelectedSiteAuditId, id)}
          data-testid="seo-audit-card"
        />

        <AuditSelectionCard
          icon={Gauge}
          title="PageSpeed Audit"
          description="Select a completed performance audit"
          emptyTitle="No PageSpeed audits"
          emptyDescription="Run a performance audit first"
          audits={perfAuditItems}
          inProgressAudits={inProgressPerfItems}
          selectedId={selectedPerfAuditId}
          onSelect={(id) => handleSelect(setSelectedPerfAuditId, id)}
          data-testid="pagespeed-audit-card"
        />

        <AuditSelectionCard
          icon={Bot}
          title="AIO Audit"
          description="Select a completed AI optimization audit"
          emptyTitle="No AIO audits"
          emptyDescription="Run an AIO audit first"
          audits={aioAuditItems}
          inProgressAudits={inProgressAioItems}
          selectedId={selectedAioAuditId}
          onSelect={(id) => handleSelect(setSelectedAioAuditId, id)}
          data-testid="aio-audit-card"
        />
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

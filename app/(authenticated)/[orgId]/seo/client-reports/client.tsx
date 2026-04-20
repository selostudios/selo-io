'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  FileText,
  Loader2,
  Trash2,
  ExternalLink,
  Plus,
  Eye,
  MoreHorizontal,
  Share2,
  Settings,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useBuildOrgHref } from '@/hooks/use-org-context'
import { formatAuditDate, getDomain } from '@/lib/utils'
import { showError } from '@/components/ui/sonner'
import { createReportFromAudit, deleteReport } from './actions'
import type { UnifiedAudit } from '@/lib/unified-audit/types'
import type { GeneratedReport } from '@/lib/reports/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface ClientReportsClientProps {
  audits: UnifiedAudit[]
  auditReportMap: Record<string, string>
  legacyReports: GeneratedReport[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}

interface AuditGroup {
  orgId: string | null
  orgName: string
  orgUrl: string | null
  audits: UnifiedAudit[]
}

export function ClientReportsClient({
  audits,
  auditReportMap,
  legacyReports,
  organizations,
  selectedOrganizationId,
}: ClientReportsClientProps) {
  const router = useRouter()
  const buildOrgHref = useBuildOrgHref()
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingForAudit, setCreatingForAudit] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<{
    id: string
    domain: string
  } | null>(null)

  const orgMap = useMemo(() => {
    const map: Record<string, OrganizationForSelector> = {}
    for (const org of organizations) {
      map[org.id] = org
    }
    return map
  }, [organizations])

  const auditGroups = useMemo(() => {
    let filtered = audits
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (a) => a.url.toLowerCase().includes(query) || a.domain.toLowerCase().includes(query)
      )
    }

    // When viewing a specific org or one-time audits, no grouping needed
    if (selectedOrganizationId) {
      return [
        {
          orgId: selectedOrganizationId,
          orgName: orgMap[selectedOrganizationId]?.name ?? '',
          orgUrl: orgMap[selectedOrganizationId]?.website_url ?? null,
          audits: filtered,
        },
      ] as AuditGroup[]
    }

    // Group by organization
    const groups: Map<string | null, UnifiedAudit[]> = new Map()
    for (const audit of filtered) {
      const key = audit.organization_id
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(audit)
    }

    // Sort: orgs first (alphabetically), then one-time at the end
    const result: AuditGroup[] = []
    const orgEntries = [...groups.entries()]
      .filter(([key]) => key !== null)
      .sort(([a], [b]) => {
        const nameA = orgMap[a!]?.name ?? ''
        const nameB = orgMap[b!]?.name ?? ''
        return nameA.localeCompare(nameB)
      })

    for (const [orgId, groupAudits] of orgEntries) {
      const org = orgMap[orgId!]
      result.push({
        orgId,
        orgName: org?.name ?? getDomain(groupAudits[0].url),
        orgUrl: org?.website_url ?? null,
        audits: groupAudits,
      })
    }

    const oneTimeAudits = groups.get(null)
    if (oneTimeAudits?.length) {
      result.push({
        orgId: null,
        orgName: 'One-Time Audits',
        orgUrl: null,
        audits: oneTimeAudits,
      })
    }

    return result
  }, [audits, selectedOrganizationId, searchQuery, orgMap])

  const filteredLegacyReports = useMemo(() => {
    let result = legacyReports
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((r) => r.domain.toLowerCase().includes(query))
    }
    return result
  }, [legacyReports, searchQuery])

  const handleCreateReport = async (auditId: string) => {
    setCreatingForAudit(auditId)
    try {
      const result = await createReportFromAudit(auditId)
      if (result.success && result.reportId) {
        router.push(buildOrgHref(`/seo/client-reports/${result.reportId}`))
      } else {
        showError(result.error || 'Failed to create report')
      }
    } catch (err) {
      console.error('[Create Report Error]', err)
      showError('Failed to create report')
    } finally {
      setCreatingForAudit(null)
    }
  }

  const handleDeleteReport = async () => {
    if (!reportToDelete) return
    setIsDeleting(true)
    try {
      const result = await deleteReport(reportToDelete.id)
      if (result.success) {
        setDeleteDialogOpen(false)
        setReportToDelete(null)
        router.refresh()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="reports-page-title">
          Audit Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Create client-facing reports from completed audits
        </p>
      </div>

      {/* Search (for one-time audits without org) */}
      {!selectedOrganizationId && audits.length > 0 && (
        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Audits Table */}
      {auditGroups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Completed Audits</CardTitle>
            <CardDescription>Create an audit report from any completed audit</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={FileText}
              title={searchQuery ? 'No audits match your search' : 'No completed audits'}
              description={
                searchQuery
                  ? 'Try a different search term'
                  : 'Run a Full Site Audit first, then create an audit report from the results.'
              }
            />
          </CardContent>
        </Card>
      ) : (
        auditGroups.map((group) => (
          <Card key={group.orgId ?? 'one-time'} className="gap-3">
            <CardHeader>
              <CardTitle>
                {group.orgName}
                {group.orgUrl && (
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    {getDomain(group.orgUrl)}
                    <span className="ml-2">
                      &middot; {group.audits.length} completed{' '}
                      {group.audits.length === 1 ? 'audit' : 'audits'}
                    </span>
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {group.audits.map((audit) => {
                  const reportId = auditReportMap[audit.id]
                  const isCreating = creatingForAudit === audit.id

                  return (
                    <div
                      key={audit.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-6">
                        <span className="text-muted-foreground w-28 text-sm">
                          {formatAuditDate(audit.created_at ?? '')}
                        </span>
                        {!group.orgId && (
                          <span className="max-w-[200px] truncate text-sm font-medium">
                            {getDomain(audit.url)}
                          </span>
                        )}
                        <span className="font-medium tabular-nums">
                          {audit.overall_score !== null ? `${audit.overall_score}/100` : '-'}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {audit.pages_crawled} {audit.pages_crawled === 1 ? 'page' : 'pages'}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          {audit.failed_count > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 tabular-nums">
                              {audit.failed_count} failed
                            </span>
                          )}
                          {audit.warning_count > 0 && (
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700 tabular-nums">
                              {audit.warning_count} warnings
                            </span>
                          )}
                          {audit.passed_count > 0 && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 tabular-nums">
                              {audit.passed_count} passed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {reportId ? (
                          <>
                            <Button asChild variant="outline" size="sm">
                              <Link href={buildOrgHref(`/seo/client-reports/${reportId}`)}>
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                View Report
                              </Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={buildOrgHref(
                                      `/seo/client-reports/${reportId}?share=true`
                                    )}
                                  >
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share Report
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={buildOrgHref(
                                      `/seo/client-reports/${reportId}?settings=true`
                                    )}
                                  >
                                    <Settings className="mr-2 h-4 w-4" />
                                    Report Settings
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setReportToDelete({
                                      id: reportId,
                                      domain: audit.domain,
                                    })
                                    setDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Report
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateReport(audit.id)}
                            disabled={isCreating}
                          >
                            {isCreating ? (
                              <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Create Report
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Legacy Reports (from old separate audit system) */}
      {filteredLegacyReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Reports</CardTitle>
            <CardDescription>Reports created from older separate audits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {filteredLegacyReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-6">
                    <span className="text-muted-foreground w-28 text-sm">
                      {formatAuditDate(report.created_at)}
                    </span>
                    <span className="max-w-[200px] truncate text-sm font-medium">
                      {report.domain}
                    </span>
                    <span className="font-medium tabular-nums">
                      {report.combined_score !== null ? `${report.combined_score}/100` : '-'}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 text-sm">
                      <Eye className="h-3.5 w-3.5" />
                      {report.view_count} views
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={buildOrgHref(`/seo/client-reports/${report.id}`)}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        View Report
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={() => {
                        setReportToDelete({ id: report.id, domain: report.domain })
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the report for{' '}
              <span className="font-medium">{reportToDelete?.domain}</span>? This action cannot be
              undone. Any share links for this report will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReport}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Report'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

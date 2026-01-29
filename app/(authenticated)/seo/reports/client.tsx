'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  FileText,
  Plus,
  Eye,
  Calendar,
  Settings,
  Share2,
  Trash2,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import type { GeneratedReport } from '@/lib/reports/types'
import { deleteReport } from './actions'
import { getScoreStatus, getScoreBadgeVariant } from '@/lib/reports'

interface ReportsClientProps {
  reports: GeneratedReport[]
  selectedOrganizationId: string | null
}

export function ReportsClient({
  reports,
  selectedOrganizationId,
}: ReportsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reportToDelete, setReportToDelete] = useState<GeneratedReport | null>(null)

  // Filter reports by organization and search query
  const filteredReports = useMemo(() => {
    let filtered = reports

    // Filter by organization if selected
    if (selectedOrganizationId) {
      filtered = filtered.filter((r) => r.organization_id === selectedOrganizationId)
    } else {
      // Show one-time reports (no organization)
      filtered = filtered.filter((r) => r.organization_id === null)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((r) => r.domain.toLowerCase().includes(query))
    }

    return filtered
  }, [reports, selectedOrganizationId, searchQuery])

  const handleDeleteReport = async () => {
    if (!reportToDelete) return

    const result = await deleteReport(reportToDelete.id)
    if (result.success) {
      setDeleteDialogOpen(false)
      setReportToDelete(null)
      router.refresh()
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getScoreBadge = (score: number | null) => {
    if (score === null) return null
    const status = getScoreStatus(score)
    const variant = getScoreBadgeVariant(status)
    return (
      <Badge variant={variant} className="font-mono">
        {score}/100
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Report History</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your consolidated marketing performance reports
          </p>
        </div>
        <Button asChild>
          <Link href="/seo/reports/new">
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Link>
        </Button>
      </div>

      {/* Search (only show for one-time reports) */}
      {!selectedOrganizationId && reports.length > 0 && (
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

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={FileText}
              title={searchQuery ? 'No reports match your search' : 'No reports yet'}
              description={
                searchQuery
                  ? 'Try a different search term'
                  : 'Generate your first consolidated report by combining SEO, PageSpeed, and AIO audits'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Score Badge */}
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      <span className="text-xl font-bold">{report.combined_score ?? '-'}</span>
                    </div>

                    {/* Report Info */}
                    <div>
                      <Link
                        href={`/seo/reports/${report.id}`}
                        className="hover:text-primary text-lg font-semibold transition-colors"
                      >
                        {report.domain}
                      </Link>
                      <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(report.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {report.view_count} views
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {getScoreBadge(report.combined_score)}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/seo/reports/${report.id}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Report
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/seo/reports/${report.id}?share=true`}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Share Report
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/seo/reports/${report.id}?settings=true`}>
                            <Settings className="mr-2 h-4 w-4" />
                            Report Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setReportToDelete(report)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Report
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

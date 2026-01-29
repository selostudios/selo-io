'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileSearch } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuditDashboard } from '@/components/audit/audit-dashboard'
import type { SiteAudit } from '@/lib/audit/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface SiteAuditClientProps {
  audits: SiteAudit[]
  archivedAudits: SiteAudit[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}

export function SiteAuditClient({
  audits,
  archivedAudits,
  organizations,
  selectedOrganizationId,
}: SiteAuditClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [oneTimeUrl, setOneTimeUrl] = useState('')

  // Determine audit target from URL params (managed by header selector)
  const selectedTarget = useMemo(() => {
    if (selectedOrganizationId) {
      const org = organizations.find((o) => o.id === selectedOrganizationId)
      if (org?.website_url) {
        return {
          type: 'organization' as const,
          organizationId: org.id,
          url: org.website_url,
        }
      }
    }
    return { type: 'one-time' as const }
  }, [selectedOrganizationId, organizations])

  const handleRunOneTimeAudit = async () => {
    if (!oneTimeUrl.trim()) return

    let url = oneTimeUrl.trim()
    // Add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    try {
      const response = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        console.error('Failed to start audit')
        return
      }

      const data = await response.json()
      router.push(`/seo/site-audit/${data.auditId}`)
    } catch (error) {
      console.error('Failed to start audit:', error)
    }
  }

  // Filter audits to match the selected target
  // - For organization targets: only show audits for that organization
  // - For one-time targets: show all one-time audits, filtered by search query
  const filteredAudits = useMemo(() => {
    if (!selectedTarget) return []

    if (selectedTarget.type === 'organization') {
      return audits.filter((audit) => audit.organization_id === selectedTarget.organizationId)
    } else {
      // One-time: show all audits with no organization_id
      let oneTimeAudits = audits.filter((audit) => audit.organization_id === null)

      // Apply search filter if query exists
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        oneTimeAudits = oneTimeAudits.filter((audit) => {
          return audit.url.toLowerCase().includes(query)
        })
      }

      return oneTimeAudits
    }
  }, [audits, selectedTarget, searchQuery])

  const filteredArchivedAudits = useMemo(() => {
    if (!selectedTarget) return []

    if (selectedTarget.type === 'organization') {
      return archivedAudits.filter(
        (audit) => audit.organization_id === selectedTarget.organizationId
      )
    } else {
      // One-time: show all archived audits with no organization_id
      let oneTimeAudits = archivedAudits.filter((audit) => audit.organization_id === null)

      // Apply search filter if query exists
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        oneTimeAudits = oneTimeAudits.filter((audit) => {
          return audit.url.toLowerCase().includes(query)
        })
      }

      return oneTimeAudits
    }
  }, [archivedAudits, selectedTarget, searchQuery])

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold">Site Audit</h1>
        <p className="text-muted-foreground mt-1">
          Crawl and analyze websites for SEO issues, missing meta tags, broken links, and technical
          problems
        </p>
      </div>

      {/* If no organizations exist, show setup message */}
      {organizations.length === 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <FileSearch className="h-6 w-6 text-neutral-600" aria-hidden="true" />
            </div>
            <CardTitle>No Organizations Yet</CardTitle>
            <CardDescription>
              Create an organization to start running site audits. Organizations let you organize
              audits for different websites.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm">
              Click the selector above to create your first organization.
            </p>
          </CardContent>
        </Card>
      )}

      {/* If organizations exist but none selected, prompt to select one */}
      {organizations.length > 0 && !selectedTarget && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <FileSearch className="h-6 w-6 text-neutral-600" aria-hidden="true" />
            </div>
            <CardTitle>Select an Audit Target</CardTitle>
            <CardDescription>
              Choose an organization or enter a one-time URL from the selector above to view its
              site audits.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Show dashboard when organization is selected */}
      {selectedTarget?.type === 'organization' && (
        <AuditDashboard
          websiteUrl={selectedTarget.url}
          audits={filteredAudits}
          archivedAudits={filteredArchivedAudits}
          organizationId={selectedTarget.organizationId}
        />
      )}

      {/* Show one-time audit interface when one-time is selected */}
      {selectedTarget?.type === 'one-time' && (
        <>
          {/* Run One-Time Audit Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>One-Time Site Audit</CardTitle>
                  <CardDescription>Add domain URL to begin crawling site</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    className="w-64"
                    id="one-time-url"
                    value={oneTimeUrl}
                    onChange={(e) => setOneTimeUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && oneTimeUrl.trim()) {
                        handleRunOneTimeAudit()
                      }
                    }}
                  />
                  <Button onClick={handleRunOneTimeAudit} disabled={!oneTimeUrl.trim()}>
                    Run Audit
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <AuditDashboard
            audits={filteredAudits}
            archivedAudits={filteredArchivedAudits}
            isOneTimeHistory
            searchInput={
              <div className="relative w-64">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  type="text"
                  placeholder="Search by URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            }
          />
        </>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Plus, Pencil, Trash2, RotateCcw, ExternalLink, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreateOrganizationDialog } from '@/components/dashboard/create-organization-dialog'
import { EditOrganizationDialog } from './edit-organization-dialog'
import { DeleteOrganizationDialog } from './delete-organization-dialog'
import { RestoreOrganizationDialog } from './restore-organization-dialog'
import { cn } from '@/lib/utils'
import { OrganizationStatus } from '@/lib/enums'
import type { Industry } from '@/lib/organizations/types'

interface Organization {
  id: string
  name: string
  website_url: string | null
  status: OrganizationStatus
  industry: string | null
  contact_email: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}

interface OrganizationsClientProps {
  organizations: Organization[]
  industries: Industry[]
}

const statusColors: Record<OrganizationStatus, string> = {
  [OrganizationStatus.Prospect]: 'bg-amber-100 text-amber-700',
  [OrganizationStatus.Customer]: 'bg-green-100 text-green-700',
  [OrganizationStatus.Inactive]: 'bg-neutral-100 text-neutral-600',
}

function getDomain(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function OrganizationsClient({ organizations, industries }: OrganizationsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null)
  const [restoringOrg, setRestoringOrg] = useState<Organization | null>(null)

  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.website_url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false)
    router.refresh()
  }

  const handleEditSuccess = () => {
    setEditingOrg(null)
    router.refresh()
  }

  const handleDeleteSuccess = () => {
    setDeletingOrg(null)
    router.refresh()
  }

  const handleRestoreSuccess = () => {
    setRestoringOrg(null)
    router.refresh()
  }

  const stats = {
    total: organizations.length,
    prospects: organizations.filter((o) => o.status === OrganizationStatus.Prospect).length,
    customers: organizations.filter((o) => o.status === OrganizationStatus.Customer).length,
    inactive: organizations.filter((o) => o.status === OrganizationStatus.Inactive).length,
  }

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-8 w-8 text-neutral-700" aria-hidden="true" />
          <div>
            <h1 className="text-3xl font-bold">Organizations</h1>
            <p className="text-muted-foreground">Manage prospect and customer organizations</p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New Organization
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prospects</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{stats.prospects}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customers</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.customers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inactive</CardDescription>
            <CardTitle className="text-2xl text-neutral-500">{stats.inactive}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Organizations</CardTitle>
            <div className="relative w-64">
              <Search
                className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Search organizations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search organizations"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-neutral-500">
                    {searchQuery ? 'No organizations match your search' : 'No organizations yet'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/settings/organization?org=${org.id}`}
                          className="font-medium hover:underline"
                        >
                          {org.name}
                        </Link>
                        {org.website_url && (
                          <a
                            href={org.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground flex items-center gap-1 text-sm hover:underline"
                          >
                            {getDomain(org.website_url)}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn('text-xs', statusColors[org.status])}
                      >
                        {org.status.charAt(0).toUpperCase() + org.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {org.contact_email ? (
                        <a href={`mailto:${org.contact_email}`} className="text-sm hover:underline">
                          {org.contact_email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(org.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingOrg(org)}
                          title="Edit organization"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        {org.status === OrganizationStatus.Inactive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRestoringOrg(org)}
                            className="text-green-600 hover:bg-green-50 hover:text-green-700"
                            title="Restore organization"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span className="sr-only">Restore</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingOrg(org)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Archive organization"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Archive</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateOrganizationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {editingOrg && (
        <EditOrganizationDialog
          organization={editingOrg}
          industries={industries}
          open={!!editingOrg}
          onOpenChange={(open) => !open && setEditingOrg(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {deletingOrg && (
        <DeleteOrganizationDialog
          organization={deletingOrg}
          open={!!deletingOrg}
          onOpenChange={(open) => !open && setDeletingOrg(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}

      {restoringOrg && (
        <RestoreOrganizationDialog
          organization={restoringOrg}
          open={!!restoringOrg}
          onOpenChange={(open) => !open && setRestoringOrg(null)}
          onSuccess={handleRestoreSuccess}
        />
      )}
    </div>
  )
}

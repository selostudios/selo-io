'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createOrganization } from '@/lib/organizations/actions'
import type { InviteInput } from '@/lib/organizations/actions'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import { UserRole } from '@/lib/enums'

interface InviteRow {
  email: string
  role: UserRole
}

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (organization: OrganizationForSelector) => void
}

const EMPTY_INVITE: InviteRow = { email: '', role: UserRole.Admin }

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([{ ...EMPTY_INVITE }])
  const [error, setError] = useState<string | null>(null)
  const [inviteWarnings, setInviteWarnings] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('')
      setWebsiteUrl('')
      setInviteRows([{ ...EMPTY_INVITE }])
      setError(null)
      setInviteWarnings([])
    }
  }, [open])

  const addInviteRow = () => {
    setInviteRows((prev) => [...prev, { ...EMPTY_INVITE }])
  }

  const removeInviteRow = (index: number) => {
    setInviteRows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateInviteRow = (index: number, field: keyof InviteRow, value: string) => {
    setInviteRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInviteWarnings([])

    if (!name.trim()) {
      setError('Organization name is required')
      return
    }

    if (!websiteUrl.trim()) {
      setError('Website URL is required')
      return
    }

    // Filter out empty invite rows
    const validInvites: InviteInput[] = inviteRows
      .filter((row) => row.email.trim())
      .map((row) => ({ email: row.email.trim(), role: row.role }))

    setIsSubmitting(true)

    try {
      const result = await createOrganization(name.trim(), websiteUrl.trim(), validInvites)

      if (result.success && result.organization) {
        if (result.inviteErrors) {
          setInviteWarnings(result.inviteErrors)
        }

        const orgForSelector: OrganizationForSelector = {
          id: result.organization.id,
          name: result.organization.name,
          website_url: result.organization.website_url,
          status: result.organization.status,
          logo_url: result.organization.logo_url ?? null,
        }
        onSuccess(orgForSelector)
        onOpenChange(false)
      } else {
        setError(result.error || 'Failed to create organization')
      }
    } catch {
      setError('Failed to create organization')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Add a new prospect organization and optionally invite team members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              placeholder="e.g., Acme Corporation…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-website">Website URL</Label>
            <Input
              id="org-website"
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          {/* Invite Members Section */}
          <div className="space-y-3">
            <Label>Invite Team Members</Label>
            <div className="space-y-2">
              {inviteRows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="email"
                    placeholder="colleague@example.com…"
                    value={row.email}
                    onChange={(e) => updateInviteRow(index, 'email', e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="off"
                    className="flex-1"
                  />
                  <Select
                    value={row.role}
                    onValueChange={(value) => updateInviteRow(index, 'role', value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UserRole.Admin}>Admin</SelectItem>
                      <SelectItem value={UserRole.TeamMember}>Team Member</SelectItem>
                      <SelectItem value={UserRole.ClientViewer}>Client Viewer</SelectItem>
                      <SelectItem value={UserRole.ExternalDeveloper}>External Developer</SelectItem>
                    </SelectContent>
                  </Select>
                  {inviteRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInviteRow(index)}
                      disabled={isSubmitting}
                      className="h-9 w-9 shrink-0"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addInviteRow}
              disabled={isSubmitting}
            >
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Add Another
            </Button>
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          {inviteWarnings.length > 0 && (
            <div className="rounded bg-amber-50 p-3 text-sm text-amber-700" role="alert">
              {inviteWarnings.map((warning, i) => (
                <p key={i}>{warning}</p>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

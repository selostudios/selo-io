'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
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
import { updateOrganization } from '@/lib/organizations/actions'
import type { OrganizationStatus, Industry } from '@/lib/organizations/types'

interface Organization {
  id: string
  name: string
  website_url: string | null
  status: OrganizationStatus
  industry: string | null
  contact_email: string | null
}

interface EditOrganizationDialogProps {
  organization: Organization
  industries: Industry[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditOrganizationDialog({
  organization,
  industries,
  open,
  onOpenChange,
  onSuccess,
}: EditOrganizationDialogProps) {
  const [name, setName] = useState(organization.name)
  const [websiteUrl, setWebsiteUrl] = useState(organization.website_url || '')
  const [status, setStatus] = useState<OrganizationStatus>(organization.status)
  const [contactEmail, setContactEmail] = useState(organization.contact_email || '')
  const [industry, setIndustry] = useState(organization.industry || '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when organization changes
  useEffect(() => {
    setName(organization.name)
    setWebsiteUrl(organization.website_url || '')
    setStatus(organization.status)
    setContactEmail(organization.contact_email || '')
    setIndustry(organization.industry || '')
    setError(null)
  }, [organization])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Organization name is required')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await updateOrganization(organization.id, {
        name: name.trim(),
        website_url: websiteUrl.trim() || null,
        status,
        contact_email: contactEmail.trim() || null,
        industry: industry.trim() || null,
      })

      if (result.success) {
        onSuccess()
      } else {
        setError(result.error || 'Failed to update organization')
      }
    } catch {
      setError('Failed to update organization')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>
            Update organization details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-org-name">Organization Name</Label>
            <Input
              id="edit-org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-org-website">Website URL</Label>
            <Input
              id="edit-org-website"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-org-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OrganizationStatus)}>
              <SelectTrigger id="edit-org-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-org-email">Contact Email</Label>
            <Input
              id="edit-org-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@example.com"
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-org-industry">Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger id="edit-org-industry">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((ind) => (
                  <SelectItem key={ind.id} value={ind.id}>
                    {ind.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
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
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

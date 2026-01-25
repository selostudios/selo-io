'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
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
import { archiveOrganization } from '@/lib/organizations/actions'

interface Organization {
  id: string
  name: string
}

interface DeleteOrganizationDialogProps {
  organization: Organization
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DeleteOrganizationDialog({
  organization,
  open,
  onOpenChange,
  onSuccess,
}: DeleteOrganizationDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConfirmed = confirmText === organization.name

  const handleDelete = async () => {
    if (!isConfirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      const result = await archiveOrganization(organization.id)

      if (result.success) {
        onSuccess()
      } else {
        setError(result.error || 'Failed to archive organization')
      }
    } catch {
      setError('Failed to archive organization')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>Archive Organization</DialogTitle>
              <DialogDescription>
                This will archive the organization and all associated data.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <strong>What happens when you archive:</strong>
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700">
              <li>Organization status will be set to &quot;inactive&quot;</li>
              <li>Team members will lose access</li>
              <li>Data is preserved for billing and audit purposes</li>
              <li>You can restore the organization later if needed</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <strong>{organization.name}</strong> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={organization.name}
              disabled={isDeleting}
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Archiving…
              </>
            ) : (
              'Archive Organization'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

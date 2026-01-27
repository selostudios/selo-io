'use client'

import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { restoreOrganization } from '@/lib/organizations/actions'

interface Organization {
  id: string
  name: string
}

interface RestoreOrganizationDialogProps {
  organization: Organization
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RestoreOrganizationDialog({
  organization,
  open,
  onOpenChange,
  onSuccess,
}: RestoreOrganizationDialogProps) {
  const [isRestoring, setIsRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRestore = async () => {
    setIsRestoring(true)
    setError(null)

    try {
      const result = await restoreOrganization(organization.id)

      if (result.success) {
        onSuccess()
      } else {
        setError(result.error || 'Failed to restore organization')
      }
    } catch {
      setError('Failed to restore organization')
    } finally {
      setIsRestoring(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <RotateCcw className="h-5 w-5 text-green-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>Restore Organization</DialogTitle>
              <DialogDescription>
                Restore <strong>{organization.name}</strong> from archived status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-800">
              <strong>What happens when you restore:</strong>
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-green-700">
              <li>Organization status will be set to &quot;prospect&quot;</li>
              <li>Organization will appear in the main selector</li>
              <li>All existing data and connections are preserved</li>
            </ul>
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isRestoring}>
            Cancel
          </Button>
          <Button onClick={handleRestore} disabled={isRestoring}>
            {isRestoring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Restoring…
              </>
            ) : (
              'Restore Organization'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

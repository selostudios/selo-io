'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateConnectionDisplayName } from '@/app/settings/integrations/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

interface EditDisplayNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  currentName: string
}

export function EditDisplayNameDialog({
  open,
  onOpenChange,
  connectionId,
  currentName,
}: EditDisplayNameDialogProps) {
  const [displayName, setDisplayName] = useState(currentName)
  const [isPending, setIsPending] = useState(false)

  async function handleSave() {
    setIsPending(true)
    const result = await updateConnectionDisplayName(connectionId, displayName)
    setIsPending(false)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('Display name updated')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Display Name</DialogTitle>
          <DialogDescription>
            Customize how this connection appears in your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending && displayName.trim()) {
                  e.preventDefault()
                  handleSave()
                }
              }}
              placeholder="e.g., Company Page, Founder"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !displayName.trim()}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

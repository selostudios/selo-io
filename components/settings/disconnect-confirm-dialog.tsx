'use client'

import { useState } from 'react'
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
import { disconnectPlatform } from '@/app/settings/integrations/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

interface DisconnectConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  accountName: string
}

export function DisconnectConfirmDialog({
  open,
  onOpenChange,
  connectionId,
  accountName,
}: DisconnectConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false)

  async function handleDisconnect() {
    setIsPending(true)
    const result = await disconnectPlatform(connectionId)
    setIsPending(false)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('Integration disconnected')
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {accountName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove all synced metrics for this account. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisconnect}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Disconnecting...' : 'Disconnect'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

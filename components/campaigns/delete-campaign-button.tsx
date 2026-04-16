'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeleteCampaignButtonProps {
  canDelete: boolean
  onDelete: () => void
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          Deleting...
        </>
      ) : (
        'Delete Campaign'
      )}
    </Button>
  )
}

export function DeleteCampaignButton({ canDelete, onDelete }: DeleteCampaignButtonProps) {
  if (!canDelete) {
    return null
  }

  return (
    <form action={onDelete}>
      <SubmitButton />
    </form>
  )
}

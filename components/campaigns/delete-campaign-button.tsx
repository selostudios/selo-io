'use client'

import { Button } from '@/components/ui/button'

interface DeleteCampaignButtonProps {
  canDelete: boolean
  onDelete: () => void
}

export function DeleteCampaignButton({ canDelete, onDelete }: DeleteCampaignButtonProps) {
  if (!canDelete) {
    return null
  }

  return (
    <form action={onDelete}>
      <Button type="submit" variant="destructive">
        Delete Campaign
      </Button>
    </form>
  )
}

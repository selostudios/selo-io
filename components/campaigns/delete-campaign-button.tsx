'use client'

import { Button } from '@/components/ui/button'

interface DeleteCampaignButtonProps {
  isAdmin: boolean
  onDelete: () => void
}

export function DeleteCampaignButton({ isAdmin, onDelete }: DeleteCampaignButtonProps) {
  if (!isAdmin) {
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

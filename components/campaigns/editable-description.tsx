'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showSuccess, showError } from '@/components/ui/sonner'
import { updateCampaignDescription } from '@/app/(authenticated)/dashboard/campaigns/actions'

interface EditableDescriptionProps {
  campaignId: string
  currentDescription: string | null
}

export function EditableDescription({ campaignId, currentDescription }: EditableDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [description, setDescription] = useState(currentDescription || '')
  const [isLoading, setIsLoading] = useState(false)

  const MAX_LENGTH = 500

  async function handleSave() {
    if (description.length > MAX_LENGTH) {
      showError(`Description must be less than ${MAX_LENGTH} characters`)
      return
    }

    setIsLoading(true)
    const result = await updateCampaignDescription(campaignId, description)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('Description updated')
      setIsEditing(false)
    }
    setIsLoading(false)
  }

  function handleCancel() {
    setDescription(currentDescription || '')
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the campaign goals…"
            aria-label="Campaign description"
            disabled={isLoading}
            rows={3}
            className="focus:ring-ring flex-1 resize-none rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          />
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={isLoading}
              aria-label="Save description"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isLoading}
              aria-label="Cancel editing"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <p
          className={`text-right text-xs ${description.length > MAX_LENGTH ? 'text-red-600' : 'text-muted-foreground'}`}
        >
          {description.length}/{MAX_LENGTH}
        </p>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2">
      <p className="text-muted-foreground text-sm">{currentDescription || 'No description'}</p>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Edit description"
      >
        <Pencil className="h-3 w-3" aria-hidden="true" />
      </Button>
    </div>
  )
}

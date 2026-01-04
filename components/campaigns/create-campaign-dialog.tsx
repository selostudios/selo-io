'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCampaign } from '@/app/dashboard/campaigns/actions'
import { useRouter } from 'next/navigation'
import { showSuccess, showError } from '@/components/ui/sonner'

const CAMPAIGN_TYPES = [
  { value: 'thought_leadership', label: 'Thought Leadership' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'lead_generation', label: 'Lead Generation' },
  { value: 'event_promotion', label: 'Event Promotion' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'other', label: 'Other' },
]

interface CreateCampaignDialogProps {
  buttonText?: string
}

export function CreateCampaignDialog({ buttonText = 'New Campaign' }: CreateCampaignDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [campaignType, setCampaignType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const router = useRouter()

  const MAX_DESCRIPTION_LENGTH = 500
  const descriptionLength = description.length
  const isDescriptionValid = descriptionLength > 0 && descriptionLength <= MAX_DESCRIPTION_LENGTH
  const isFormValid = name.trim() && isDescriptionValid && startDate && endDate && campaignType

  async function handleSubmit(formData: FormData) {
    if (!startDate || !endDate) {
      showError('Both start and end dates are required')
      return
    }

    // Add select values to formData
    formData.set('type', campaignType)

    setIsLoading(true)

    const result = await createCampaign(formData)

    if (result?.error) {
      showError(result.error)
      setIsLoading(false)
    } else if (result?.success) {
      showSuccess('Campaign created successfully!')
      setOpen(false)
      resetForm()
      router.push(`/dashboard/campaigns/${result.campaign.id}`)
    }
  }

  function resetForm() {
    setName('')
    setDescription('')
    setCampaignType('')
    setStartDate('')
    setEndDate('')
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen)
    if (!newOpen) {
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
          <DialogDescription>
            Set up a new marketing campaign with tracking parameters
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="e.g., Q1 2026 Thought Leadership"
              required
              disabled={isLoading}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              type="text"
              placeholder="Brief description of the campaign goals"
              disabled={isLoading}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p
              className={`text-right text-xs ${descriptionLength > MAX_DESCRIPTION_LENGTH ? 'text-red-600' : 'text-muted-foreground'}`}
            >
              {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Campaign Type</Label>
            <Select value={campaignType} onValueChange={setCampaignType} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select campaign type" />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                required
                disabled={isLoading}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                required
                disabled={isLoading}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || !isFormValid}>
              {isLoading ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

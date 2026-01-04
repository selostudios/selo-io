'use client'

import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { showSuccess, showError } from '@/components/ui/sonner'
import { updateUtmMedium } from '@/app/dashboard/campaigns/actions'

const MEDIUM_OPTIONS = [
  { value: 'email', description: 'Email campaigns, newsletters' },
  { value: 'social', description: 'Organic social media posts' },
  { value: 'cpc', description: 'Paid ads (cost-per-click)' },
  { value: 'display', description: 'Banner/display ads' },
  { value: 'referral', description: 'Partner/referral links' },
  { value: 'organic', description: 'Organic search' },
]

interface UtmMediumSelectProps {
  campaignId: string
  currentValue: string
}

export function UtmMediumSelect({ campaignId, currentValue }: UtmMediumSelectProps) {
  const [value, setValue] = useState(currentValue)
  const [isUpdating, setIsUpdating] = useState(false)

  async function handleChange(newValue: string) {
    setValue(newValue)
    setIsUpdating(true)

    const result = await updateUtmMedium(campaignId, newValue)

    if (result.error) {
      showError(result.error)
      setValue(currentValue) // Revert on error
    } else {
      showSuccess('Medium updated')
    }

    setIsUpdating(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    showSuccess('Copied utm_medium to clipboard')
  }

  const selectedOption = MEDIUM_OPTIONS.find(opt => opt.value === value)

  return (
    <div className="flex justify-between items-center bg-neutral-50 rounded-l overflow-hidden">
      <div className="flex items-center">
        <span className="font-mono text-sm bg-neutral-700 text-white px-4 py-3">utm_medium</span>
        <Select value={value} onValueChange={handleChange} disabled={isUpdating}>
          <SelectTrigger className="w-[320px] border-0 rounded-none shadow-none">
            <SelectValue>
              <span className="font-mono">{value}</span>
              {selectedOption && (
                <span className="text-muted-foreground ml-2">- {selectedOption.description}</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MEDIUM_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="font-mono">{option.value}</span>
                <span className="text-muted-foreground ml-2">- {option.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0 mr-2">
        <Copy className="h-4 w-4" />
        <span className="sr-only">Copy utm_medium</span>
      </Button>
    </div>
  )
}

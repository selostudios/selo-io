'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const MEDIUM_OPTIONS = [
  { value: 'email', description: 'Email campaigns, newsletters' },
  { value: 'social', description: 'Organic social media posts' },
  { value: 'cpc', description: 'Paid ads (cost-per-click)' },
  { value: 'display', description: 'Banner/display ads' },
  { value: 'referral', description: 'Partner/referral links' },
  { value: 'organic', description: 'Organic search' },
]

interface UtmMediumSelectProps {
  value: string
  description?: string
  onChange?: (value: string) => void
}

export function UtmMediumSelect({ value, description, onChange }: UtmMediumSelectProps) {
  const selectedOption = MEDIUM_OPTIONS.find((opt) => opt.value === value)

  return (
    <div className="flex items-center overflow-hidden rounded-l bg-neutral-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">
              utm_medium
            </span>
          </TooltipTrigger>
          {description && (
            <TooltipContent side="top" align="start" className="max-w-xs">
              <p>{description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <Select value={value} onValueChange={(val) => onChange?.(val)}>
        <SelectTrigger className="flex-1 rounded-none border-0 shadow-none">
          <SelectValue>
            <span className="font-mono" style={{ color: value ? '#171717' : '#9ca3af' }}>
              {value || 'Not set'}
            </span>
            {selectedOption && (
              <span className="text-muted-foreground ml-2">- {selectedOption.description}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MEDIUM_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="font-mono" style={{ color: '#171717' }}>
                {option.value}
              </span>
              <span className="text-muted-foreground ml-2">- {option.description}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

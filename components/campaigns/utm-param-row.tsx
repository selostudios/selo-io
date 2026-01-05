'use client'

import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface UtmParamRowProps {
  label: string
  value: string
  description?: string
  onChange?: (value: string) => void
}

export function UtmParamRow({ label, value, description, onChange }: UtmParamRowProps) {
  return (
    <div className="flex items-center overflow-hidden rounded-l bg-neutral-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">{label}</span>
          </TooltipTrigger>
          {description && (
            <TooltipContent side="top" align="start" className="max-w-xs">
              <p>{description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="flex-1 rounded-none border-0 font-mono text-sm shadow-none"
        style={{ color: value ? '#171717' : '#9ca3af' }}
        placeholder="Not set"
      />
    </div>
  )
}

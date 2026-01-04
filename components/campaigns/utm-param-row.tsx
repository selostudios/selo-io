'use client'

import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showSuccess } from '@/components/ui/sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface UtmParamRowProps {
  label: string
  value: string
  description?: string
}

export function UtmParamRow({ label, value, description }: UtmParamRowProps) {
  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    showSuccess(`Copied ${label} to clipboard`)
  }

  return (
    <div className="flex items-center justify-between overflow-hidden rounded-l bg-neutral-50">
      <div className="flex items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">
                {label}
              </span>
            </TooltipTrigger>
            {description && (
              <TooltipContent side="top" align="start" className="max-w-xs">
                <p>{description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <code className="px-4 text-sm" style={{ color: value ? '#171717' : '#9ca3af' }}>
          {value || 'Not set'}
        </code>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} className="mr-2 h-8 w-8 p-0">
        <Copy className="h-4 w-4" />
        <span className="sr-only">Copy {label}</span>
      </Button>
    </div>
  )
}

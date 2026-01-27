'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TokenUsageBadgeProps {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost?: number
  model?: string
}

export function TokenUsageBadge({
  inputTokens,
  outputTokens,
  totalTokens,
  cost,
  model = 'claude-opus-4-20250514',
}: TokenUsageBadgeProps) {
  const formattedCost = cost?.toFixed(4) ?? '0.0000'
  const formattedTokens = totalTokens.toLocaleString()

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Tokens:</span>
        <span className="font-medium">{formattedTokens}</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Cost:</span>
        <span className="font-medium">${formattedCost}</span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
          >
            <Info className="size-3.5" />
            <span className="sr-only">Token usage details</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">AI Analysis Details</p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Model:</span>
              <span className="font-mono">{model}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Input tokens:</span>
              <span className="font-mono">{inputTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Output tokens:</span>
              <span className="font-mono">{outputTokens.toLocaleString()}</span>
            </div>
            <div className="mt-2 border-t pt-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Total cost:</span>
                <span className="font-mono font-medium">${formattedCost}</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

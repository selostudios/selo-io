'use client'

import { Info } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SampleSizeSelectorProps {
  value: number
  onChange: (value: number) => void
  pagesFound?: number
  disabled?: boolean
}

// Cost estimates based on Claude Opus 4.5 pricing
// $15 per 1M input tokens, $75 per 1M output tokens
// Average: ~5,500 input tokens and ~1,900 output tokens per page
const ESTIMATED_COST_PER_PAGE = 0.175

export function SampleSizeSelector({
  value,
  onChange,
  pagesFound,
  disabled = false,
}: SampleSizeSelectorProps) {
  const estimatedCost = (value * ESTIMATED_COST_PER_PAGE).toFixed(2)

  const handleValueChange = (values: number[]) => {
    onChange(values[0])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="sample-size" className="text-sm font-medium">
            Sample Size
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
              >
                <Info className="size-3.5" />
                <span className="sr-only">How sample size works</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium">AI Analysis Sample Size</p>
              <p className="mt-1 text-xs opacity-90">
                We rank pages by importance (depth, freshness, content type) and analyze the top N
                pages with AI. Higher sample sizes provide more comprehensive analysis but increase
                cost and time.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Estimated cost:</span>
          <span className="font-medium">${estimatedCost}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Slider
          id="sample-size"
          min={1}
          max={10}
          step={1}
          value={[value]}
          onValueChange={handleValueChange}
          disabled={disabled}
          className="w-full"
        />
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>1 page</span>
          <div className="flex items-center gap-1">
            <span className="text-foreground font-medium">{value}</span>
            <span>pages selected</span>
            {pagesFound && <span className="ml-1">(of {pagesFound} found)</span>}
          </div>
          <span>10 pages</span>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Analyzing {value} {value === 1 ? 'page' : 'pages'} will take approximately{' '}
        {value <= 3 ? '10-20' : value <= 6 ? '20-40' : '40-60'} seconds.
      </p>
    </div>
  )
}

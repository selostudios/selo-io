'use client'

import { Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StyleMemoPopover, type StyleMemoPopoverProps } from './style-memo-popover'

export type StyleMemoButtonProps = StyleMemoPopoverProps

export function StyleMemoButton(props: StyleMemoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Style memo"
          data-testid="style-memo-button"
        >
          <Brain className="size-4" aria-hidden />
          Learning
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <StyleMemoPopover {...props} />
      </PopoverContent>
    </Popover>
  )
}

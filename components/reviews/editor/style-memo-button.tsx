'use client'

import { Brain } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HeaderActionButton } from './header-action-button'
import { StyleMemoPopover, type StyleMemoPopoverProps } from './style-memo-popover'

export type StyleMemoButtonProps = StyleMemoPopoverProps

export function StyleMemoButton(props: StyleMemoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <HeaderActionButton type="button" aria-label="Style memo" data-testid="style-memo-button">
          <Brain className="size-4" aria-hidden />
          Learning
        </HeaderActionButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <StyleMemoPopover {...props} />
      </PopoverContent>
    </Popover>
  )
}

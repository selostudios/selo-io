'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CollapsibleContextType {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextType | undefined>(undefined)

function useCollapsible() {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error('Collapsible components must be used within a Collapsible')
  }
  return context
}

interface CollapsibleProps extends React.ComponentProps<'div'> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

function Collapsible({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  className,
  children,
  ...props
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const onOpenChange = isControlled ? (controlledOnOpenChange ?? (() => {})) : setUncontrolledOpen

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange }}>
      <div data-state={open ? 'open' : 'closed'} className={className} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({
  className,
  children,
  asChild,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const { open, onOpenChange } = useCollapsible()

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{ onClick?: () => void }>,
      {
        onClick: () => onOpenChange(!open),
        'data-state': open ? 'open' : 'closed',
      } as React.HTMLAttributes<HTMLElement>
    )
  }

  return (
    <button
      type="button"
      data-state={open ? 'open' : 'closed'}
      onClick={() => onOpenChange(!open)}
      className={cn('flex w-full items-center', className)}
      {...props}
    >
      {children}
    </button>
  )
}

function CollapsibleContent({ className, children, ...props }: React.ComponentProps<'div'>) {
  const { open } = useCollapsible()

  return (
    <div
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'overflow-hidden transition-all',
        open ? 'animate-collapsible-down' : 'hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }

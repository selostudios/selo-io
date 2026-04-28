import * as React from 'react'
import { Button } from '@/components/ui/button'

export interface HeaderActionButtonProps extends React.ComponentProps<typeof Button> {
  /**
   * `'primary'` renders a filled button (shadcn `default` variant) for the
   * single most-prominent action in the header (Publish). Defaults to
   * `'secondary'`, which renders the outlined style shared by the other
   * header actions (Learning, Preview, Snapshots).
   */
  emphasis?: 'primary' | 'secondary'
}

/**
 * Single source of truth for the report editor header buttons so Learning,
 * Preview, Snapshots and Publish stay visually consistent (same height,
 * same icon-vs-text gap, same padding). Forwards every other prop to the
 * underlying shadcn `Button`, including `asChild` for `<Link>` wrapping.
 */
export function HeaderActionButton({
  emphasis = 'secondary',
  variant,
  size = 'default',
  ...rest
}: HeaderActionButtonProps) {
  const resolvedVariant = variant ?? (emphasis === 'primary' ? 'default' : 'outline')
  return <Button variant={resolvedVariant} size={size} {...rest} />
}

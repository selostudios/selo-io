'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Triggers the browser print dialog. Rendered as a regular page-level action
 * so the deck chrome itself stays free of surface-specific controls; each
 * page decides whether printing makes sense (e.g. shown on published
 * snapshots and public shares, omitted on drafts).
 */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="print-button">
      <Printer className="mr-2 size-4" aria-hidden="true" />
      Print
    </Button>
  )
}

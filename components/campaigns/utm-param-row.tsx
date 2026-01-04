'use client'

import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showSuccess } from '@/components/ui/sonner'

interface UtmParamRowProps {
  label: string
  value: string
}

export function UtmParamRow({ label, value }: UtmParamRowProps) {
  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    showSuccess(`Copied ${label} to clipboard`)
  }

  return (
    <div className="flex justify-between items-center p-3 bg-neutral-50 rounded">
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-muted-foreground">{label}</span>
        <code className="text-sm bg-black text-white px-2 py-1 rounded">{value}</code>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0">
        <Copy className="h-4 w-4" />
        <span className="sr-only">Copy {label}</span>
      </Button>
    </div>
  )
}

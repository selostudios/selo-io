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
    <div className="flex justify-between items-center bg-neutral-50 rounded-l overflow-hidden">
      <div className="flex items-center">
        <span className="font-mono text-sm bg-neutral-700 text-white px-4 py-3">{label}</span>
        <code className="text-sm px-4">{value}</code>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0 mr-2">
        <Copy className="h-4 w-4" />
        <span className="sr-only">Copy {label}</span>
      </Button>
    </div>
  )
}

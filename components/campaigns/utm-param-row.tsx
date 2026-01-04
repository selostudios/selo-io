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
    <div className="flex items-center justify-between overflow-hidden rounded-l bg-neutral-50">
      <div className="flex items-center">
        <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">{label}</span>
        <code className="px-4 text-sm">{value}</code>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} className="mr-2 h-8 w-8 p-0">
        <Copy className="h-4 w-4" />
        <span className="sr-only">Copy {label}</span>
      </Button>
    </div>
  )
}

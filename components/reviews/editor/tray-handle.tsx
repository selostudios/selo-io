import { ChevronDown, ChevronUp } from 'lucide-react'

export interface TrayHandleProps {
  expanded: boolean
  onToggle: () => void
}

export function TrayHandle({ expanded, onToggle }: TrayHandleProps) {
  const Icon = expanded ? ChevronDown : ChevronUp
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label="Toggle slide tray"
      data-testid="tray-handle"
      className="text-muted-foreground hover:bg-muted/50 flex h-8 w-full items-center justify-center"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

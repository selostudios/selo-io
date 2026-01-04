import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface UtmParamRowProps {
  label: string
  value: string
  description?: string
}

export function UtmParamRow({ label, value, description }: UtmParamRowProps) {
  return (
    <div className="flex items-center overflow-hidden rounded-l bg-neutral-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">{label}</span>
          </TooltipTrigger>
          {description && (
            <TooltipContent side="top" align="start" className="max-w-xs">
              <p>{description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <code className="px-4 text-sm" style={{ color: value ? '#171717' : '#9ca3af' }}>
        {value || 'Not set'}
      </code>
    </div>
  )
}

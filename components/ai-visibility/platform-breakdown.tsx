import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AIPlatform } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES } from '@/lib/ai-visibility/types'
import type { PlatformBreakdown as PlatformBreakdownType } from '@/lib/ai-visibility/types'

interface PlatformBreakdownProps {
  breakdown: PlatformBreakdownType | null
}

const PLATFORM_BAR_COLORS: Record<string, string> = {
  [AIPlatform.ChatGPT]: 'bg-green-500',
  [AIPlatform.Claude]: 'bg-orange-500',
  [AIPlatform.Perplexity]: 'bg-blue-500',
}

export function PlatformBreakdown({ breakdown }: PlatformBreakdownProps) {
  if (!breakdown) return null

  const platforms = Object.entries(breakdown)
  if (platforms.length === 0) return null

  const maxMentions = Math.max(...platforms.map(([, v]) => v.mentions), 1)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Platform Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {platforms.map(([platform, stats]) => (
          <div key={platform} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {PLATFORM_DISPLAY_NAMES[platform as AIPlatform] ?? platform}
              </span>
              <span className="text-muted-foreground">
                {stats.mentions} mentions · {stats.citations} citations
              </span>
            </div>
            <div className="bg-muted h-2 rounded-full">
              <div
                className={`h-2 rounded-full ${PLATFORM_BAR_COLORS[platform] ?? 'bg-primary'}`}
                style={{ width: `${(stats.mentions / maxMentions) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

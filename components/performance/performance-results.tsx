'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScoreGauge } from './score-gauge'
import { CoreWebVitals } from './core-web-vitals'
import type { PerformanceAuditResult, DeviceType } from '@/lib/performance/types'
import { Smartphone, Monitor } from 'lucide-react'

interface PerformanceResultsProps {
  results: PerformanceAuditResult[]
}

export function PerformanceResults({ results }: PerformanceResultsProps) {
  const [device, setDevice] = useState<DeviceType>('mobile')

  // Group results by URL
  const resultsByUrl = results.reduce(
    (acc, result) => {
      if (!acc[result.url]) {
        acc[result.url] = { mobile: null, desktop: null }
      }
      acc[result.url][result.device] = result
      return acc
    },
    {} as Record<string, { mobile: PerformanceAuditResult | null; desktop: PerformanceAuditResult | null }>
  )

  const urls = Object.keys(resultsByUrl)

  if (urls.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No results yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Device Toggle */}
      <Tabs value={device} onValueChange={(v) => setDevice(v as DeviceType)}>
        <TabsList>
          <TabsTrigger value="mobile" className="gap-2">
            <Smartphone className="size-4" />
            Mobile
          </TabsTrigger>
          <TabsTrigger value="desktop" className="gap-2">
            <Monitor className="size-4" />
            Desktop
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results by URL */}
      {urls.map((url) => {
        const result = resultsByUrl[url][device]
        if (!result) return null

        return (
          <Card key={url}>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {new URL(url).pathname || '/'}
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Lighthouse Scores */}
              <div>
                <h4 className="text-muted-foreground mb-4 text-sm font-medium">Lighthouse Scores</h4>
                <div className="flex flex-wrap justify-center gap-6 sm:justify-start">
                  <ScoreGauge score={result.performance_score} label="Performance" />
                  <ScoreGauge score={result.accessibility_score} label="Accessibility" />
                  <ScoreGauge score={result.best_practices_score} label="Best Practices" />
                  <ScoreGauge score={result.seo_score} label="SEO" />
                </div>
              </div>

              {/* Core Web Vitals */}
              <div>
                <h4 className="text-muted-foreground mb-4 text-sm font-medium">
                  Core Web Vitals (Field Data)
                </h4>
                <CoreWebVitals
                  lcp={{ value: result.lcp_ms, rating: result.lcp_rating }}
                  inp={{ value: result.inp_ms, rating: result.inp_rating }}
                  cls={{ value: result.cls_score, rating: result.cls_rating }}
                />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScoreCard } from '@/components/audit/score-cards'
import { CoreWebVitals } from './core-web-vitals'
import { OpportunitiesList } from './opportunities-list'
import { DiagnosticsList } from './diagnostics-list'
import type { PerformanceAuditResult, DeviceType, PageSpeedResult } from '@/lib/performance/types'
import { extractOpportunities, extractDiagnostics } from '@/lib/performance/api'
import { Smartphone, Monitor, ExternalLink, FileText } from 'lucide-react'

function formatUrlDisplay(url: string): string {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace(/^www\./, '')
    const pathname = parsed.pathname
    // If home page, just show domain
    if (pathname === '/' || pathname === '') {
      return domain
    }
    // Otherwise show domain + path
    return `${domain}${pathname}`
  } catch {
    return url
  }
}

const METRIC_DESCRIPTIONS = {
  Performance:
    'Measures how quickly the page loads and becomes interactive. Factors include First Contentful Paint, Speed Index, and Time to Interactive.',
  Accessibility:
    'Evaluates how accessible the page is to users with disabilities. Checks for proper ARIA labels, color contrast, keyboard navigation, and semantic HTML.',
  'Best Practices':
    'Checks for modern web development best practices including HTTPS usage, avoiding deprecated APIs, and proper image aspect ratios.',
  SEO: 'Evaluates search engine optimization. Checks for meta descriptions, crawlable links, valid robots.txt, and mobile-friendly design.',
}

interface PerformanceResultsProps {
  results: PerformanceAuditResult[]
}

export function PerformanceResults({ results }: PerformanceResultsProps) {
  const [device, setDevice] = useState<DeviceType>('mobile')

  // Log full PageSpeed API response data
  useEffect(() => {
    if (results.length > 0) {
      results.forEach((result) => {
        console.log(`[PageSpeed API] ${result.url} (${result.device}):`, result.raw_response)
      })
    }
  }, [results])

  // Group results by URL
  const resultsByUrl = results.reduce(
    (acc, result) => {
      if (!acc[result.url]) {
        acc[result.url] = { mobile: null, desktop: null }
      }
      acc[result.url][result.device] = result
      return acc
    },
    {} as Record<
      string,
      { mobile: PerformanceAuditResult | null; desktop: PerformanceAuditResult | null }
    >
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
      <Tabs
        value={device}
        onValueChange={(v) => setDevice(v as DeviceType)}
        aria-label="Select device type"
      >
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
          <div key={url} className="space-y-6">
            {/* Page URL Header */}
            <Card className="py-4">
              <CardContent className="py-0">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-base font-medium hover:underline"
                >
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  {formatUrlDisplay(url)}
                  <ExternalLink className="text-muted-foreground size-3.5" />
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </CardContent>
            </Card>

            {/* Lighthouse Scores */}
            <div>
              <h4 className="text-muted-foreground mb-4 text-sm font-medium">Lighthouse Scores</h4>
              <div className="flex gap-4">
                <ScoreCard
                  score={result.performance_score}
                  label="Performance"
                  description={METRIC_DESCRIPTIONS.Performance}
                />
                <ScoreCard
                  score={result.accessibility_score}
                  label="Accessibility"
                  description={METRIC_DESCRIPTIONS.Accessibility}
                />
                <ScoreCard
                  score={result.best_practices_score}
                  label="Best Practices"
                  description={METRIC_DESCRIPTIONS['Best Practices']}
                />
                <ScoreCard
                  score={result.seo_score}
                  label="SEO"
                  description={METRIC_DESCRIPTIONS.SEO}
                />
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

            {/* Opportunities and Diagnostics */}
            {result.raw_response &&
              (() => {
                const rawResponse = result.raw_response as unknown as PageSpeedResult
                const opportunities = extractOpportunities(rawResponse)
                const diagnostics = extractDiagnostics(rawResponse)

                if (opportunities.length === 0 && diagnostics.length === 0) {
                  return null
                }

                return (
                  <div className="space-y-4 rounded-lg border border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                    {opportunities.length > 0 && (
                      <OpportunitiesList opportunities={opportunities} />
                    )}
                    {diagnostics.length > 0 && <DiagnosticsList diagnostics={diagnostics} />}
                  </div>
                )
              })()}
          </div>
        )
      })}
    </div>
  )
}

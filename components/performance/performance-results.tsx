'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ScoreCard } from '@/components/audit/score-cards'
import { CoreWebVitals } from './core-web-vitals'
import { OpportunitiesList } from './opportunities-list'
import { DiagnosticsList } from './diagnostics-list'
import type { PerformanceAuditResult, DeviceType, PageSpeedResult } from '@/lib/performance/types'
import { extractOpportunities, extractDiagnostics } from '@/lib/performance/api'

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
  device: DeviceType
}

export function PerformanceResults({ results, device }: PerformanceResultsProps) {
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

  // Check if selected device has any results
  const hasResultsForDevice = urls.some((url) => resultsByUrl[url][device] !== null)
  const otherDevice = device === 'mobile' ? 'desktop' : 'mobile'
  const hasResultsForOtherDevice = urls.some((url) => resultsByUrl[url][otherDevice] !== null)

  // Show message if no results for selected device but other device has results
  if (!hasResultsForDevice && hasResultsForOtherDevice) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-amber-500" />
          <p className="font-medium">No {device} results available</p>
          <p className="text-muted-foreground mt-1 text-sm">
            The {device} audit may have timed out or encountered an error.
            <br />
            Try switching to {otherDevice} to see available results.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Results by URL */}
      {urls.map((url) => {
        const result = resultsByUrl[url][device]
        if (!result) return null

        return (
          <div key={url} className="space-y-6">
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

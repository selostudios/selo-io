'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePolling } from '@/hooks/use-polling'
import { ResearchResultList } from './research-result-list'
import { AddPromptDialog } from './add-prompt-dialog'
import { linkResearchResultsToPrompt } from '@/app/(authenticated)/[orgId]/ai-visibility/actions'
import type { AIPlatform } from '@/lib/enums'
import type { ResearchResult } from '@/lib/ai-visibility/research'
import type { TopicWithPrompts } from '@/lib/ai-visibility/queries'

interface ResearchSectionProps {
  orgId: string
  orgName: string
  websiteUrl: string | null
  competitors: { name: string; domain: string }[]
  existingTopics: TopicWithPrompts[]
  monthlySpendCents: number
  monthlyBudgetCents: number
}

const POLLING_TIMEOUT_MS = 30_000

export function ResearchSection({
  orgId,
  orgName,
  websiteUrl,
  competitors,
  existingTopics,
  monthlySpendCents,
  monthlyBudgetCents,
}: ResearchSectionProps) {
  const [promptText, setPromptText] = useState('')
  const [researchId, setResearchId] = useState<string | null>(null)
  const [expectedPlatforms, setExpectedPlatforms] = useState<AIPlatform[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savedPromptText, setSavedPromptText] = useState<string | null>(null)

  const fetchResults = useCallback(async (): Promise<ResearchResult[]> => {
    const response = await fetch(`/api/ai-visibility/research/${researchId}/results`)
    return response.json()
  }, [researchId])

  const { data: results } = usePolling<ResearchResult[]>({
    fetcher: fetchResults,
    enabled: !!researchId,
    intervalMs: 2000,
    isComplete: (data) => data.length >= expectedPlatforms.length,
    onComplete: () => setTimedOut(false),
  })

  // Timeout handling
  const timeoutRef = useRef<NodeJS.Timeout>(undefined)
  useEffect(() => {
    if (!researchId) return
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true)
    }, POLLING_TIMEOUT_MS)
    return () => clearTimeout(timeoutRef.current)
  }, [researchId])

  // Clear timeout when all results arrive
  useEffect(() => {
    if (results && results.length >= expectedPlatforms.length) {
      clearTimeout(timeoutRef.current)
    }
  }, [results, expectedPlatforms.length])

  const budgetExceeded = monthlyBudgetCents > 0 && monthlySpendCents >= monthlyBudgetCents

  const startResearch = async (confirmed = false) => {
    if (!confirmed && budgetExceeded) {
      setShowConfirm(true)
      return
    }

    setShowConfirm(false)
    setIsStarting(true)
    setError(null)
    setTimedOut(false)

    try {
      const response = await fetch('/api/ai-visibility/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          promptText: promptText.trim(),
          websiteUrl,
          orgName,
          competitors,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to start research')
      }

      const data = await response.json()
      setResearchId(data.researchId)
      setExpectedPlatforms(data.platforms)
      setSavedPromptText(promptText.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsStarting(false)
    }
  }

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`

  const handleSaveToMonitoring = () => {
    setSaveDialogOpen(true)
  }

  const handleSaved = async (promptId: string) => {
    if (!researchId) return
    await linkResearchResultsToPrompt(orgId, researchId, promptId)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Research a Prompt</h2>

      {/* Input bar */}
      <div className="flex gap-2">
        <Input
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Type a prompt to test across AI platforms..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && promptText.trim()) startResearch()
          }}
          className="flex-1"
        />
        <Button
          onClick={() => startResearch()}
          disabled={!promptText.trim() || isStarting}
          data-testid="research-run-button"
        >
          <Search className="mr-2 size-4" />
          {isStarting ? 'Starting...' : 'Run'}
        </Button>
      </div>

      {/* Budget info */}
      <p className="text-muted-foreground text-xs">
        Budget: {formatCents(monthlySpendCents)} / {formatCents(monthlyBudgetCents)} used this month
      </p>

      {/* Budget exceeded confirmation */}
      {showConfirm && (
        <div className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-3">
          <AlertTriangle className="size-4 shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            Budget exceeded ({formatCents(monthlySpendCents)} / {formatCents(monthlyBudgetCents)}).
            Run anyway?
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => startResearch(true)}>
              Run anyway
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {researchId && (
        <ResearchResultList
          results={results ?? []}
          expectedPlatforms={expectedPlatforms}
          onSaveToMonitoring={handleSaveToMonitoring}
          timedOut={timedOut}
        />
      )}

      {/* Save to monitoring dialog */}
      {saveDialogOpen && savedPromptText && (
        <AddPromptDialog
          orgId={orgId}
          existingTopics={existingTopics}
          defaultPromptText={savedPromptText}
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

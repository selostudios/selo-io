import { useState, useCallback } from 'react'
import type { AIOPageAnalysis } from '@/lib/aio/types'

export interface ProgrammaticCheck {
  category: string
  name: string
  status: 'passed' | 'failed' | 'warning'
  displayName: string
}

export interface PageSelection {
  url: string
  importanceScore: number
  reasons: string[]
}

export interface AIOAuditState {
  status: 'idle' | 'running_programmatic' | 'running_ai' | 'complete' | 'error'
  auditId: string | null
  pagesFound: number
  programmaticChecks: ProgrammaticCheck[]
  technicalScore: number | null
  selectedPages: PageSelection[]
  aiAnalyses: AIOPageAnalysis[]
  strategicScore: number | null
  overallScore: number | null
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  cost: number
  executionTime: number | null
  error: string | null
}

export function useAIOAuditStream() {
  const [state, setState] = useState<AIOAuditState>({
    status: 'idle',
    auditId: null,
    pagesFound: 0,
    programmaticChecks: [],
    technicalScore: null,
    selectedPages: [],
    aiAnalyses: [],
    strategicScore: null,
    overallScore: null,
    tokenUsage: {
      input: 0,
      output: 0,
      total: 0,
    },
    cost: 0,
    executionTime: null,
    error: null,
  })

  const handleEvent = useCallback((event: { type: string; [key: string]: unknown }) => {
    switch (event.type) {
      case 'status':
        setState((prev) => ({
          ...prev,
          status: event.status as AIOAuditState['status'],
        }))
        break

      case 'crawl_complete':
        setState((prev) => ({
          ...prev,
          pagesFound: event.pagesFound as number,
        }))
        break

      case 'programmatic_check':
        setState((prev) => ({
          ...prev,
          programmaticChecks: [...prev.programmaticChecks, event.check as ProgrammaticCheck],
        }))
        break

      case 'programmatic_complete':
        setState((prev) => ({
          ...prev,
          technicalScore: event.technicalScore as number,
        }))
        break

      case 'ai_selection':
        setState((prev) => ({
          ...prev,
          selectedPages: event.selectedPages as PageSelection[],
        }))
        break

      case 'ai_batch_complete':
        setState((prev) => ({
          ...prev,
          aiAnalyses: [...prev.aiAnalyses, ...(event.analyses as AIOPageAnalysis[])],
          tokenUsage: {
            input: prev.tokenUsage.input + ((event.tokens as { promptTokens: number }).promptTokens || 0),
            output: prev.tokenUsage.output + ((event.tokens as { completionTokens: number }).completionTokens || 0),
            total:
              prev.tokenUsage.total +
              ((event.tokens as { promptTokens: number; completionTokens: number }).promptTokens || 0) +
              ((event.tokens as { promptTokens: number; completionTokens: number }).completionTokens || 0),
          },
          cost: prev.cost + (event.cost as number),
        }))
        break

      case 'complete':
        setState((prev) => ({
          ...prev,
          status: 'complete',
          auditId: event.auditId as string,
          technicalScore: event.technicalScore as number,
          strategicScore: event.strategicScore as number,
          overallScore: event.overallScore as number,
          executionTime: event.executionTime as number,
          tokenUsage: event.tokenUsage as AIOAuditState['tokenUsage'],
          cost: event.cost as number,
        }))
        break

      case 'error':
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: event.message as string,
        }))
        break

      default:
        console.warn('[AIO Audit Stream] Unknown event type:', event.type)
    }
  }, [])

  const startAudit = useCallback(
    async (organizationId: string | null, url: string, sampleSize: number) => {
      // Reset state
      setState({
        status: 'idle',
        auditId: null,
        pagesFound: 0,
        programmaticChecks: [],
        technicalScore: null,
        selectedPages: [],
        aiAnalyses: [],
        strategicScore: null,
        overallScore: null,
        tokenUsage: {
          input: 0,
          output: 0,
          total: 0,
        },
        cost: 0,
        executionTime: null,
        error: null,
      })

      try {
        const response = await fetch('/api/aio/audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId,
            url,
            sampleSize,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to start audit')
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Read SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          // Decode chunk
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6))
              handleEvent(data)
            }
          }
        }
      } catch (error) {
        console.error('[AIO Audit Stream] Error:', error)
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      }
    },
    [handleEvent]
  )

  return {
    ...state,
    startAudit,
  }
}

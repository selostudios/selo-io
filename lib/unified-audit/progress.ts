import { UnifiedAuditStatus } from '@/lib/enums'
import type { UnifiedAudit } from './types'

type PhaseStatus = 'pending' | 'running' | 'complete'

export interface AuditProgress {
  phase:
    | 'crawling'
    | 'analyzing'
    | 'scoring'
    | 'completed'
    | 'failed'
    | 'awaiting_confirmation'
    | 'stopped'
  crawl: {
    status: PhaseStatus
    pagesCrawled: number
    maxPages: number
  }
  analysis: {
    checks: { status: PhaseStatus; completed: number; total: number }
    psi: { status: PhaseStatus; completed: number; total: number }
    ai: { status: PhaseStatus; completed: number; total: number }
  }
  scoring: { status: PhaseStatus }
}

/**
 * Compute the current progress of an audit based on its status and check counts.
 *
 * @param audit - The audit record
 * @param checkCount - Number of checks completed so far
 * @param totalChecks - Expected total number of checks (estimate)
 */
export function computeProgress(
  audit: Pick<UnifiedAudit, 'status' | 'pages_crawled' | 'max_pages' | 'overall_score'>,
  checkCount: number,
  totalChecks: number
): AuditProgress {
  const status = audit.status

  const crawlComplete =
    status === UnifiedAuditStatus.Checking ||
    status === UnifiedAuditStatus.Completed ||
    status === UnifiedAuditStatus.Stopped ||
    status === UnifiedAuditStatus.AwaitingConfirmation

  const checksComplete =
    status === UnifiedAuditStatus.Completed || status === UnifiedAuditStatus.Stopped

  const scoringComplete =
    status === UnifiedAuditStatus.Completed || status === UnifiedAuditStatus.Stopped

  // Determine current phase
  let phase: AuditProgress['phase']
  if (status === UnifiedAuditStatus.Failed) {
    phase = 'failed'
  } else if (status === UnifiedAuditStatus.Stopped) {
    phase = 'stopped'
  } else if (status === UnifiedAuditStatus.AwaitingConfirmation) {
    phase = 'awaiting_confirmation'
  } else if (status === UnifiedAuditStatus.Completed) {
    phase = 'completed'
  } else if (status === UnifiedAuditStatus.Checking) {
    phase = 'analyzing'
  } else if (
    status === UnifiedAuditStatus.Crawling ||
    status === UnifiedAuditStatus.Pending ||
    status === UnifiedAuditStatus.BatchComplete
  ) {
    phase = 'crawling'
  } else {
    phase = 'crawling'
  }

  // If scoring is complete but checks show analysis phase, adjust
  if (audit.overall_score !== null && status === UnifiedAuditStatus.Completed) {
    phase = 'completed'
  }

  return {
    phase,
    crawl: {
      status: crawlComplete
        ? 'complete'
        : status === UnifiedAuditStatus.Crawling || status === UnifiedAuditStatus.BatchComplete
          ? 'running'
          : 'pending',
      pagesCrawled: audit.pages_crawled,
      maxPages: audit.max_pages,
    },
    analysis: {
      checks: {
        status: checksComplete ? 'complete' : crawlComplete ? 'running' : 'pending',
        completed: checkCount,
        total: totalChecks,
      },
      psi: {
        status: 'pending',
        completed: 0,
        total: 0,
      },
      ai: {
        status: 'pending',
        completed: 0,
        total: 0,
      },
    },
    scoring: {
      status: scoringComplete ? 'complete' : checksComplete ? 'running' : 'pending',
    },
  }
}

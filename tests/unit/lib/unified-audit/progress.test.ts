import { describe, it, expect } from 'vitest'
import { computeProgress } from '@/lib/unified-audit/progress'
import { UnifiedAuditStatus } from '@/lib/enums'

describe('computeProgress', () => {
  it('returns crawling phase when status is crawling', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Crawling,
        pages_crawled: 10,
        max_pages: 100,
        overall_score: null,
      },
      0,
      0
    )

    expect(progress.phase).toBe('crawling')
    expect(progress.crawl.status).toBe('running')
    expect(progress.crawl.pagesCrawled).toBe(10)
    expect(progress.crawl.maxPages).toBe(100)
    expect(progress.analysis.checks.status).toBe('pending')
    expect(progress.scoring.status).toBe('pending')
  })

  it('returns crawling phase when status is pending', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Pending,
        pages_crawled: 0,
        max_pages: 100,
        overall_score: null,
      },
      0,
      0
    )

    expect(progress.phase).toBe('crawling')
    expect(progress.crawl.status).toBe('pending')
  })

  it('returns crawling phase when status is batch_complete', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.BatchComplete,
        pages_crawled: 50,
        max_pages: 200,
        overall_score: null,
      },
      120,
      200
    )

    expect(progress.phase).toBe('crawling')
    expect(progress.crawl.status).toBe('running')
  })

  it('returns analyzing phase when status is checking', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Checking,
        pages_crawled: 50,
        max_pages: 50,
        overall_score: null,
      },
      100,
      200
    )

    expect(progress.phase).toBe('analyzing')
    expect(progress.crawl.status).toBe('complete')
    expect(progress.analysis.checks.status).toBe('running')
    expect(progress.analysis.checks.completed).toBe(100)
    expect(progress.analysis.checks.total).toBe(200)
    expect(progress.scoring.status).toBe('pending')
  })

  it('returns analyzing phase when status is analyzing', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Analyzing,
        pages_crawled: 50,
        max_pages: 50,
        overall_score: null,
      },
      200,
      200
    )

    expect(progress.phase).toBe('analyzing')
    expect(progress.crawl.status).toBe('complete')
    expect(progress.analysis.checks.status).toBe('complete')
    expect(progress.scoring.status).toBe('pending')
  })

  it('returns completed phase when status is completed', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Completed,
        pages_crawled: 50,
        max_pages: 50,
        overall_score: 85,
      },
      200,
      200
    )

    expect(progress.phase).toBe('completed')
    expect(progress.crawl.status).toBe('complete')
    expect(progress.analysis.checks.status).toBe('complete')
    expect(progress.scoring.status).toBe('complete')
  })

  it('returns failed phase when status is failed', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Failed,
        pages_crawled: 5,
        max_pages: 100,
        overall_score: null,
      },
      10,
      100
    )

    expect(progress.phase).toBe('failed')
  })

  it('returns stopped phase when status is stopped', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Stopped,
        pages_crawled: 30,
        max_pages: 100,
        overall_score: 70,
      },
      90,
      100
    )

    expect(progress.phase).toBe('stopped')
    expect(progress.crawl.status).toBe('complete')
    expect(progress.analysis.checks.status).toBe('complete')
    expect(progress.scoring.status).toBe('complete')
  })

  it('returns awaiting_confirmation phase for exhaustive mode soft cap', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.AwaitingConfirmation,
        pages_crawled: 100,
        max_pages: 100,
        overall_score: null,
      },
      0,
      0
    )

    expect(progress.phase).toBe('awaiting_confirmation')
    expect(progress.crawl.status).toBe('complete')
  })

  it('PSI and AI default to pending with zero counts when no progress data provided', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Checking,
        pages_crawled: 10,
        max_pages: 10,
        overall_score: null,
      },
      50,
      100
    )

    expect(progress.analysis.psi.status).toBe('pending')
    expect(progress.analysis.psi.completed).toBe(0)
    expect(progress.analysis.psi.total).toBe(0)
    expect(progress.analysis.ai.status).toBe('pending')
    expect(progress.analysis.ai.completed).toBe(0)
    expect(progress.analysis.ai.total).toBe(0)
  })

  it('shows PSI and AI as running during analyzing status with progress data', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Analyzing,
        pages_crawled: 50,
        max_pages: 50,
        overall_score: null,
      },
      200,
      200,
      {
        psiCompleted: 2,
        psiTotal: 5,
        aiCompleted: 1,
        aiTotal: 5,
      }
    )

    expect(progress.phase).toBe('analyzing')
    expect(progress.analysis.psi.status).toBe('running')
    expect(progress.analysis.psi.completed).toBe(2)
    expect(progress.analysis.psi.total).toBe(5)
    expect(progress.analysis.ai.status).toBe('running')
    expect(progress.analysis.ai.completed).toBe(1)
    expect(progress.analysis.ai.total).toBe(5)
  })

  it('shows PSI and AI as complete when completed', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Completed,
        pages_crawled: 50,
        max_pages: 50,
        overall_score: 85,
      },
      200,
      200,
      {
        psiCompleted: 5,
        psiTotal: 5,
        aiCompleted: 5,
        aiTotal: 5,
      }
    )

    expect(progress.analysis.psi.status).toBe('complete')
    expect(progress.analysis.ai.status).toBe('complete')
  })

  it('marks PSI/AI as complete when individual counts match totals during analyzing', () => {
    const progress = computeProgress(
      {
        status: UnifiedAuditStatus.Analyzing,
        pages_crawled: 50,
        max_pages: 50,
        overall_score: null,
      },
      200,
      200,
      {
        psiCompleted: 5,
        psiTotal: 5,
        aiCompleted: 3,
        aiTotal: 5,
      }
    )

    expect(progress.analysis.psi.status).toBe('complete')
    expect(progress.analysis.ai.status).toBe('running')
  })
})

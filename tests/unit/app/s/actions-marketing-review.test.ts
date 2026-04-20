import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { getSharedMarketingReviewData } from '@/app/s/[token]/actions'
import { createServiceClient } from '@/lib/supabase/server'

type MaybeSingleResult<T> = { data: T | null; error: { message: string } | null }

function chainReturning<T>(result: MaybeSingleResult<T>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  }
  return chain
}

interface SnapshotRow {
  id: string
  review_id: string
  version: number
  period_start: string
  period_end: string
  data: unknown
  narrative: unknown
  published_at: string | null
}

interface ReviewRow {
  id: string
  quarter: string
  organization_id: string
  title: string
}

interface OrgRow {
  id: string
  name: string
  logo_url: string | null
  primary_color: string | null
}

function makeSupabase({
  snapshot,
  review,
  organization,
}: {
  snapshot: MaybeSingleResult<SnapshotRow>
  review?: MaybeSingleResult<ReviewRow>
  organization?: MaybeSingleResult<OrgRow>
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'marketing_review_snapshots') return chainReturning(snapshot)
      if (table === 'marketing_reviews')
        return chainReturning(review ?? { data: null, error: null })
      if (table === 'organizations')
        return chainReturning(organization ?? { data: null, error: null })
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('getSharedMarketingReviewData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns null when the snapshot cannot be found', async () => {
    const supabase = makeSupabase({
      snapshot: { data: null, error: null },
    })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never)

    const result = await getSharedMarketingReviewData('missing-snapshot')
    expect(result).toBeNull()
  })

  test('returns null when the parent review cannot be loaded', async () => {
    const supabase = makeSupabase({
      snapshot: {
        data: {
          id: 'snap-1',
          review_id: 'review-1',
          version: 2,
          period_start: '2026-01-01',
          period_end: '2026-03-31',
          data: {},
          narrative: { cover_subtitle: 'hello' },
          published_at: '2026-04-01T00:00:00Z',
        },
        error: null,
      },
      review: { data: null, error: null },
    })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never)

    const result = await getSharedMarketingReviewData('snap-1')
    expect(result).toBeNull()
  })

  test('returns null when the organization cannot be loaded', async () => {
    const supabase = makeSupabase({
      snapshot: {
        data: {
          id: 'snap-1',
          review_id: 'review-1',
          version: 1,
          period_start: '2026-01-01',
          period_end: '2026-03-31',
          data: {},
          narrative: {},
          published_at: null,
        },
        error: null,
      },
      review: {
        data: {
          id: 'review-1',
          quarter: '2026-Q1',
          organization_id: 'org-1',
          title: 'Q1 Review',
        },
        error: null,
      },
      organization: { data: null, error: null },
    })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never)

    const result = await getSharedMarketingReviewData('snap-1')
    expect(result).toBeNull()
  })

  test('assembles snapshot, review, and organization into the shared payload', async () => {
    const narrative = {
      cover_subtitle: 'Strong quarter',
      ga_summary: 'Traffic is up',
    }
    const data = { ga: { sessions: { current: 100, qoq: 80, yoy: 60 } } }

    const supabase = makeSupabase({
      snapshot: {
        data: {
          id: 'snap-1',
          review_id: 'review-1',
          version: 3,
          period_start: '2026-01-01',
          period_end: '2026-03-31',
          data,
          narrative,
          published_at: '2026-04-01T12:34:00Z',
        },
        error: null,
      },
      review: {
        data: {
          id: 'review-1',
          quarter: '2026-Q1',
          organization_id: 'org-1',
          title: 'Q1 Review',
        },
        error: null,
      },
      organization: {
        data: {
          id: 'org-1',
          name: 'Acme Co',
          logo_url: 'https://cdn.example.com/logo.png',
          primary_color: '#112233',
        },
        error: null,
      },
    })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never)

    const result = await getSharedMarketingReviewData('snap-1')
    expect(result).toEqual({
      organization: {
        name: 'Acme Co',
        logo_url: 'https://cdn.example.com/logo.png',
        primary_color: '#112233',
      },
      quarter: 'Q1 2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      narrative,
      data,
      version: 3,
      publishedAt: '2026-04-01T12:34:00Z',
    })
  })

  test('tolerates null narrative and data by returning empty objects', async () => {
    const supabase = makeSupabase({
      snapshot: {
        data: {
          id: 'snap-1',
          review_id: 'review-1',
          version: 1,
          period_start: '2026-01-01',
          period_end: '2026-03-31',
          data: null,
          narrative: null,
          published_at: null,
        },
        error: null,
      },
      review: {
        data: {
          id: 'review-1',
          quarter: '2026-Q2',
          organization_id: 'org-1',
          title: 'Q2 Review',
        },
        error: null,
      },
      organization: {
        data: {
          id: 'org-1',
          name: 'Acme Co',
          logo_url: null,
          primary_color: null,
        },
        error: null,
      },
    })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never)

    const result = await getSharedMarketingReviewData('snap-1')
    expect(result).not.toBeNull()
    expect(result!.narrative).toEqual({})
    expect(result!.data).toEqual({})
    expect(result!.quarter).toBe('Q2 2026')
    expect(result!.organization.logo_url).toBeNull()
    expect(result!.organization.primary_color).toBeNull()
  })

  test('returns null when the snapshot query errors', async () => {
    const supabase = makeSupabase({
      snapshot: { data: null, error: { message: 'boom' } },
    })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await getSharedMarketingReviewData('snap-1')
    expect(result).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

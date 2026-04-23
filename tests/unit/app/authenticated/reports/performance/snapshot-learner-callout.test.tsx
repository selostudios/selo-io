import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { SnapshotLearnerCallout } from '@/app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/snapshot-learner-callout'
import { createClient } from '@/lib/supabase/server'

type MaybeSingleResult<T> = { data: T | null; error: { message: string } | null }

interface VersionRow {
  rationale: string | null
  created_at: string
}

function chainReturning<T>(result: MaybeSingleResult<T>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  }
  return chain
}

function mockSupabaseReturning(result: MaybeSingleResult<VersionRow>) {
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => chainReturning(result)),
  } as never)
}

const ORG_ID = '11111111-1111-1111-1111-111111111111'
const SNAPSHOT_ID = '22222222-2222-2222-2222-222222222222'

describe('SnapshotLearnerCallout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders rationale when an auto version row exists', async () => {
    mockSupabaseReturning({
      data: {
        rationale: 'Noticed author prefers plain numbers.',
        created_at: '2026-04-21T10:00:00.000Z',
      },
      error: null,
    })

    const jsx = await SnapshotLearnerCallout({
      snapshotId: SNAPSHOT_ID,
      orgId: ORG_ID,
      canManage: true,
    })

    render(jsx!)

    expect(screen.getByTestId('snapshot-learner-callout')).toBeInTheDocument()
    expect(screen.getByTestId('snapshot-learner-callout-rationale')).toHaveTextContent(
      'Noticed author prefers plain numbers.'
    )
    expect(screen.getByText(/View full history/i)).toBeInTheDocument()
  })

  test('hides the history link when canManage is false', async () => {
    mockSupabaseReturning({
      data: {
        rationale: 'Noticed author prefers plain numbers.',
        created_at: '2026-04-21T10:00:00.000Z',
      },
      error: null,
    })

    const jsx = await SnapshotLearnerCallout({
      snapshotId: SNAPSHOT_ID,
      orgId: ORG_ID,
      canManage: false,
    })

    render(jsx!)

    expect(screen.getByTestId('snapshot-learner-callout')).toBeInTheDocument()
    expect(screen.queryByText(/View full history/i)).toBeNull()
  })

  test('returns null when no version row exists for the snapshot', async () => {
    mockSupabaseReturning({ data: null, error: null })

    const jsx = await SnapshotLearnerCallout({
      snapshotId: SNAPSHOT_ID,
      orgId: ORG_ID,
      canManage: true,
    })

    expect(jsx).toBeNull()
  })

  test('returns null when the version row has a null rationale', async () => {
    mockSupabaseReturning({
      data: {
        rationale: null,
        created_at: '2026-04-21T10:00:00.000Z',
      },
      error: null,
    })

    const jsx = await SnapshotLearnerCallout({
      snapshotId: SNAPSHOT_ID,
      orgId: ORG_ID,
      canManage: true,
    })

    expect(jsx).toBeNull()
  })
})

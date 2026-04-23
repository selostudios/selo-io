import { beforeEach, describe, expect, test, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { makeChain, mockSupabaseFrom } from '@/tests/helpers/supabase-mocks'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { StyleMemoHistoryTimeline } from '@/app/(authenticated)/[orgId]/reports/performance/settings/style-memo-history-timeline'
import { createClient } from '@/lib/supabase/server'

type QueryResult<T> = { data: T | null; error: { message: string } | null }

interface VersionDbRow {
  id: string
  organization_id: string
  snapshot_id: string | null
  memo: string
  rationale: string | null
  source: 'auto' | 'manual'
  created_by: string | null
  created_at: string
}

interface SnapshotDbRow {
  id: string
  review_id: string
  marketing_reviews: { quarter: string } | { quarter: string }[]
}

interface UserDbRow {
  id: string
  first_name: string | null
  last_name: string | null
}

function setupSupabase(options: {
  versions: QueryResult<VersionDbRow[]>
  snapshots?: QueryResult<SnapshotDbRow[]>
  users?: QueryResult<UserDbRow[]>
}) {
  const versionsChain = makeChain({
    limit: vi.fn(async () => options.versions),
  })
  const snapshotsChain = makeChain({
    in: vi.fn(async () => options.snapshots ?? { data: [], error: null }),
  })
  const usersChain = makeChain({
    in: vi.fn(async () => options.users ?? { data: [], error: null }),
  })

  vi.mocked(createClient).mockResolvedValue(
    mockSupabaseFrom({
      marketing_review_style_memo_versions: versionsChain,
      marketing_review_snapshots: snapshotsChain,
      users: usersChain,
    }) as never
  )

  return { versionsChain, snapshotsChain, usersChain }
}

const ORG_ID = '11111111-1111-1111-1111-111111111111'

describe('StyleMemoHistoryTimeline', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  test('renders empty state when no rows exist', async () => {
    const { snapshotsChain, usersChain } = setupSupabase({
      versions: { data: [], error: null },
    })

    const jsx = await StyleMemoHistoryTimeline({ orgId: ORG_ID })
    render(jsx)

    expect(screen.getByTestId('style-memo-history-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('style-memo-history-empty-state')).toBeInTheDocument()
    expect(snapshotsChain.in).not.toHaveBeenCalled()
    expect(usersChain.in).not.toHaveBeenCalled()
  })

  test('renders one row per version ordered newest first', async () => {
    setupSupabase({
      versions: {
        data: [
          {
            id: 'v1',
            organization_id: ORG_ID,
            snapshot_id: null,
            memo: 'memo one',
            rationale: 'rationale one',
            source: 'auto',
            created_by: null,
            created_at: '2026-04-21T10:00:00.000Z',
          },
          {
            id: 'v2',
            organization_id: ORG_ID,
            snapshot_id: null,
            memo: 'memo two',
            rationale: null,
            source: 'manual',
            created_by: null,
            created_at: '2026-04-20T10:00:00.000Z',
          },
        ],
        error: null,
      },
    })

    const jsx = await StyleMemoHistoryTimeline({ orgId: ORG_ID })
    render(jsx)

    expect(screen.getByTestId('style-memo-history-row-0')).toBeInTheDocument()
    expect(screen.getByTestId('style-memo-history-row-1')).toBeInTheDocument()
  })

  test('auto row shows rationale and Auto badge', async () => {
    setupSupabase({
      versions: {
        data: [
          {
            id: 'v1',
            organization_id: ORG_ID,
            snapshot_id: null,
            memo: 'memo body',
            rationale: 'Noticed X.',
            source: 'auto',
            created_by: null,
            created_at: '2026-04-21T10:00:00.000Z',
          },
        ],
        error: null,
      },
    })

    const jsx = await StyleMemoHistoryTimeline({ orgId: ORG_ID })
    render(jsx)

    expect(screen.getByText('Noticed X.')).toBeInTheDocument()
    expect(screen.getByText('Auto')).toBeInTheDocument()
  })

  test('manual row shows admin name and Manual badge', async () => {
    const userId = '33333333-3333-3333-3333-333333333333'
    setupSupabase({
      versions: {
        data: [
          {
            id: 'v1',
            organization_id: ORG_ID,
            snapshot_id: null,
            memo: 'manual memo',
            rationale: null,
            source: 'manual',
            created_by: userId,
            created_at: '2026-04-21T10:00:00.000Z',
          },
        ],
        error: null,
      },
      users: {
        data: [{ id: userId, first_name: 'Owain', last_name: null }],
        error: null,
      },
    })

    const jsx = await StyleMemoHistoryTimeline({ orgId: ORG_ID })
    render(jsx)

    expect(screen.getByText(/Manual edit by Owain/)).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  test('logs and renders empty state when the main versions query fails', async () => {
    setupSupabase({
      versions: { data: null, error: { message: 'versions boom' } },
    })

    const jsx = await StyleMemoHistoryTimeline({ orgId: ORG_ID })
    render(jsx)

    expect(screen.getByTestId('style-memo-history-empty-state')).toBeInTheDocument()
    const versionsErrorLogged = errorSpy.mock.calls.some(
      (call) =>
        call[0] === '[StyleMemoHistoryTimeline Error]' &&
        typeof call[1] === 'object' &&
        call[1] !== null &&
        (call[1] as { type?: string }).type === 'memo_versions_query_failed'
    )
    expect(versionsErrorLogged).toBe(true)
  })

  test('still renders rows when the creators query returns an error', async () => {
    const userId = '33333333-3333-3333-3333-333333333333'
    setupSupabase({
      versions: {
        data: [
          {
            id: 'v1',
            organization_id: ORG_ID,
            snapshot_id: null,
            memo: 'manual memo',
            rationale: null,
            source: 'manual',
            created_by: userId,
            created_at: '2026-04-21T10:00:00.000Z',
          },
        ],
        error: null,
      },
      users: { data: null, error: { message: 'users boom' } },
    })

    const jsx = await StyleMemoHistoryTimeline({ orgId: ORG_ID })
    render(jsx)

    expect(screen.getByTestId('style-memo-history-row-0')).toBeInTheDocument()
    expect(screen.getByText('Manual edit')).toBeInTheDocument()
    const creatorsErrorLogged = errorSpy.mock.calls.some(
      (call) =>
        call[0] === '[StyleMemoHistoryTimeline Error]' &&
        typeof call[1] === 'object' &&
        call[1] !== null &&
        (call[1] as { type?: string }).type === 'creators_query_failed'
    )
    expect(creatorsErrorLogged).toBe(true)
  })

  test('still renders rows when the snapshot-join query returns an error', async () => {
    setupSupabase({
      versions: {
        data: [
          {
            id: 'v1',
            organization_id: ORG_ID,
            snapshot_id: '22222222-2222-2222-2222-222222222222',
            memo: 'memo body',
            rationale: 'Learned something.',
            source: 'auto',
            created_by: null,
            created_at: '2026-04-21T10:00:00.000Z',
          },
        ],
        error: null,
      },
      snapshots: { data: null, error: { message: 'boom' } },
    })

    const jsx = await StyleMemoHistoryTimeline({ orgId: ORG_ID })
    render(jsx)

    expect(screen.getByTestId('style-memo-history-row-0')).toBeInTheDocument()
    const calls = errorSpy.mock.calls
    const snapshotErrorLogged = calls.some(
      (call) =>
        typeof call[1] === 'object' &&
        call[1] !== null &&
        (call[1] as { type?: string }).type === 'snapshots_query_failed'
    )
    expect(snapshotErrorLogged).toBe(true)
  })
})

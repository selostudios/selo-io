import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

// Hoisted platform action mocks — shared across tests so we can assert call counts/args.
const mocks = vi.hoisted(() => ({
  syncMetricsForLinkedInConnection: vi.fn(async () => {}),
  syncLinkedInPosts: vi.fn(async () => {}),
  syncMetricsForGoogleAnalyticsConnection: vi.fn(async () => {}),
  syncMetricsForHubSpotConnection: vi.fn(async () => {}),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/platforms/linkedin/actions', () => ({
  syncMetricsForLinkedInConnection: mocks.syncMetricsForLinkedInConnection,
  syncLinkedInPosts: mocks.syncLinkedInPosts,
}))

vi.mock('@/lib/platforms/google-analytics/actions', () => ({
  syncMetricsForGoogleAnalyticsConnection: mocks.syncMetricsForGoogleAnalyticsConnection,
}))

vi.mock('@/lib/platforms/hubspot/actions', () => ({
  syncMetricsForHubSpotConnection: mocks.syncMetricsForHubSpotConnection,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mocks.createServiceClient(),
}))

interface FakeConnection {
  id: string
  organization_id: string
  platform_type: 'linkedin' | 'google_analytics' | 'hubspot'
  credentials: Record<string, unknown>
  status: 'active'
}

/**
 * Builds a Supabase fake that returns `connections` for the platform_connections
 * query and handles the cron_execution_log insert/update chains the route uses.
 */
function makeFakeSupabase(connections: FakeConnection[]) {
  const platformConnectionsQuery = {
    eq: vi.fn().mockImplementation(function eq(this: unknown) {
      return platformConnectionsQuery
    }),
    then: (resolve: (v: { data: FakeConnection[]; error: null }) => unknown) =>
      resolve({ data: connections, error: null }),
  }

  const logInsertChain = {
    select: () => ({
      single: () => Promise.resolve({ data: { id: 'log-1' }, error: null }),
    }),
  }

  const logUpdateChain = {
    eq: () => Promise.resolve({ error: null }),
  }

  const from = vi.fn((table: string) => {
    if (table === 'cron_execution_log') {
      return {
        insert: () => logInsertChain,
        update: () => logUpdateChain,
      }
    }
    if (table === 'platform_connections') {
      return {
        select: () => ({
          eq: () => platformConnectionsQuery,
        }),
      }
    }
    throw new Error(`Unexpected table in fake Supabase: ${table}`)
  })

  return { from }
}

function makeRequest(body?: Record<string, unknown>, includeAuth = true): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (includeAuth) headers.authorization = 'Bearer test-secret'
  return new Request('http://localhost/api/cron/daily-metrics-sync', {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

const linkedinConnection: FakeConnection = {
  id: 'conn-linkedin-1',
  organization_id: 'org-1',
  platform_type: 'linkedin',
  credentials: { access_token: 'tok', organization_urn: 'urn:li:organization:1' },
  status: 'active',
}

const hubspotConnection: FakeConnection = {
  id: 'conn-hubspot-1',
  organization_id: 'org-1',
  platform_type: 'hubspot',
  credentials: { access_token: 'hub' },
  status: 'active',
}

const gaConnection: FakeConnection = {
  id: 'conn-ga-1',
  organization_id: 'org-1',
  platform_type: 'google_analytics',
  credentials: { access_token: 'ga' },
  status: 'active',
}

describe('POST /api/cron/daily-metrics-sync', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret'
  })

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('calls syncLinkedInPosts once per active LinkedIn connection in normal mode', async () => {
    const supabase = makeFakeSupabase([linkedinConnection])
    mocks.createServiceClient.mockReturnValueOnce(supabase)

    const { POST } = await import('@/app/api/cron/daily-metrics-sync/route')
    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(mocks.syncMetricsForLinkedInConnection).toHaveBeenCalledTimes(1)
    expect(mocks.syncLinkedInPosts).toHaveBeenCalledTimes(1)
    expect(mocks.syncLinkedInPosts).toHaveBeenCalledWith(
      linkedinConnection.id,
      linkedinConnection.organization_id,
      linkedinConnection.credentials,
      supabase
    )
  })

  test('does not call syncLinkedInPosts during backfill', async () => {
    const supabase = makeFakeSupabase([linkedinConnection])
    mocks.createServiceClient.mockReturnValueOnce(supabase)

    const { POST } = await import('@/app/api/cron/daily-metrics-sync/route')
    const res = await POST(makeRequest({ startDate: '2026-01-01', endDate: '2026-01-03' }))

    expect(res.status).toBe(200)
    expect(mocks.syncMetricsForLinkedInConnection).toHaveBeenCalledTimes(3)
    expect(mocks.syncLinkedInPosts).not.toHaveBeenCalled()
  })

  test('does not call syncLinkedInPosts for non-LinkedIn connections', async () => {
    const supabase = makeFakeSupabase([hubspotConnection, gaConnection])
    mocks.createServiceClient.mockReturnValueOnce(supabase)

    const { POST } = await import('@/app/api/cron/daily-metrics-sync/route')
    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(mocks.syncMetricsForHubSpotConnection).toHaveBeenCalledTimes(1)
    expect(mocks.syncMetricsForGoogleAnalyticsConnection).toHaveBeenCalledTimes(1)
    expect(mocks.syncLinkedInPosts).not.toHaveBeenCalled()
  })

  test('swallows syncLinkedInPosts errors without failing the whole cron run', async () => {
    const supabase = makeFakeSupabase([linkedinConnection])
    mocks.createServiceClient.mockReturnValueOnce(supabase)
    mocks.syncLinkedInPosts.mockRejectedValueOnce(new Error('posts boom'))

    const errorSpy = vi.spyOn(console, 'error')

    const { POST } = await import('@/app/api/cron/daily-metrics-sync/route')
    const res = await POST(makeRequest())
    const body = (await res.json()) as { failed: number; synced: number }

    expect(res.status).toBe(200)
    expect(body.failed).toBe(0)
    expect(body.synced).toBe(1)

    const loggedPostsFailure = errorSpy.mock.calls.some(
      (call) =>
        typeof call[1] === 'object' &&
        call[1] !== null &&
        (call[1] as { type?: string }).type === 'sync_linkedin_posts_failed'
    )
    expect(loggedPostsFailure).toBe(true)
  })

  test('rejects unauthorized requests', async () => {
    const { POST } = await import('@/app/api/cron/daily-metrics-sync/route')
    const res = await POST(makeRequest(undefined, false))

    expect(res.status).toBe(401)
    expect(mocks.syncMetricsForLinkedInConnection).not.toHaveBeenCalled()
    expect(mocks.syncLinkedInPosts).not.toHaveBeenCalled()
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })
})

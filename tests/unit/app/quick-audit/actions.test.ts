import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock query builder chain
const mockLimit = vi.fn().mockResolvedValue({ data: [] })
const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
const mockEqCreatedBy = vi.fn().mockReturnValue({ order: mockOrder })
const mockIsNull = vi.fn().mockReturnValue({ eq: mockEqCreatedBy })
const mockSelect = vi.fn().mockReturnValue({ is: mockIsNull })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const mockGetAuthUser = vi.fn()
const mockGetUserRecord = vi.fn()

vi.mock('@/lib/auth/cached', () => ({
  getAuthUser: () => mockGetAuthUser(),
  getUserRecord: (id: string) => mockGetUserRecord(id),
}))

// Mock redirect to throw so we can catch it
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

import { getQuickAudits } from '@/app/(authenticated)/quick-audit/actions'

describe('getQuickAudits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login when user is not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null)

    await expect(getQuickAudits()).rejects.toThrow('REDIRECT:/login')
  })

  it('redirects to login when user record is not found', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockGetUserRecord.mockResolvedValue(null)

    await expect(getQuickAudits()).rejects.toThrow('REDIRECT:/login')
  })

  it('redirects to dashboard for non-internal users', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockGetUserRecord.mockResolvedValue({
      id: 'user-1',
      is_internal: false,
      organization_id: 'org-1',
      role: 'admin',
    })

    await expect(getQuickAudits()).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('queries only one-time audits created by the current user', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockGetUserRecord.mockResolvedValue({
      id: 'user-1',
      is_internal: true,
      role: 'developer',
    })
    mockLimit.mockResolvedValue({ data: [] })

    await getQuickAudits()

    expect(mockFrom).toHaveBeenCalledWith('audits')
    expect(mockIsNull).toHaveBeenCalledWith('organization_id', null)
    expect(mockEqCreatedBy).toHaveBeenCalledWith('created_by', 'user-1')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(50)
  })

  it('returns audits for internal users', async () => {
    const mockAudits = [
      {
        id: 'audit-1',
        organization_id: null,
        created_by: 'user-1',
        domain: 'example.com',
        url: 'https://example.com',
        status: 'completed',
        overall_score: 75,
        pages_crawled: 10,
        passed_count: 30,
        warning_count: 5,
        failed_count: 3,
        created_at: '2026-04-10T00:00:00Z',
      },
      {
        id: 'audit-2',
        organization_id: null,
        created_by: 'user-1',
        domain: 'test.com',
        url: 'https://test.com',
        status: 'failed',
        overall_score: null,
        pages_crawled: 0,
        passed_count: 0,
        warning_count: 0,
        failed_count: 0,
        created_at: '2026-04-09T00:00:00Z',
      },
    ]

    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockGetUserRecord.mockResolvedValue({
      id: 'user-1',
      is_internal: true,
      role: 'developer',
    })
    mockLimit.mockResolvedValue({ data: mockAudits })

    const result = await getQuickAudits()
    expect(result).toEqual(mockAudits)
  })

  it('returns empty array when no audits exist', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' })
    mockGetUserRecord.mockResolvedValue({
      id: 'user-1',
      is_internal: true,
      role: 'developer',
    })
    mockLimit.mockResolvedValue({ data: null })

    const result = await getQuickAudits()
    expect(result).toEqual([])
  })
})

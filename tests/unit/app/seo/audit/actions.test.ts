import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnifiedAuditStatus } from '@/lib/enums'

// Mock Supabase client with chainable query builder
const mockDeleteEq = vi.fn().mockReturnValue({ error: null })
const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq })
const mockSingleAudit = vi.fn()
const mockSingleUser = vi.fn()
const mockEqAudit = vi.fn().mockReturnValue({ single: mockSingleAudit })
const mockEqUser = vi.fn().mockReturnValue({ single: mockSingleUser })
const mockSelectAll = vi.fn().mockReturnValue({ eq: mockEqAudit })
const mockSelectUser = vi.fn().mockReturnValue({ eq: mockEqUser })

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'users') {
    return { select: mockSelectUser }
  }
  if (table === 'audits') {
    return { select: mockSelectAll, delete: mockDelete }
  }
  // audit_checks, audit_pages, audit_ai_analyses
  return { delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) }) }
})

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: () => mockGetUser() },
  }),
}))

// Must import after mocks
import { deleteUnifiedAudit } from '@/app/(authenticated)/[orgId]/seo/audit/actions'

describe('deleteUnifiedAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await deleteUnifiedAudit('audit-1')
    expect(result.error).toBe('Unauthorized')
  })

  it('returns error when audit is in progress', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingleUser.mockResolvedValue({
      data: {
        id: 'user-1',
        is_internal: false,
        team_members: [{ organization_id: 'org-1', role: 'admin' }],
      },
    })
    mockSingleAudit.mockResolvedValue({
      data: {
        id: 'audit-1',
        organization_id: 'org-1',
        created_by: 'user-1',
        status: UnifiedAuditStatus.Crawling,
      },
    })

    const result = await deleteUnifiedAudit('audit-1')
    expect(result.error).toBe('Cannot delete an in-progress audit')
  })

  it('returns error when user has no access to the audit', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingleUser.mockResolvedValue({
      data: {
        id: 'user-1',
        is_internal: false,
        team_members: [{ organization_id: 'org-1', role: 'team_member' }],
      },
    })
    mockSingleAudit.mockResolvedValue({
      data: {
        id: 'audit-1',
        organization_id: 'org-2', // different org
        created_by: 'other-user',
        status: UnifiedAuditStatus.Completed,
      },
    })

    const result = await deleteUnifiedAudit('audit-1')
    expect(result.error).toBe('Audit not found')
  })

  it('allows deleting a completed audit the user owns', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingleUser.mockResolvedValue({
      data: {
        id: 'user-1',
        is_internal: false,
        team_members: [{ organization_id: 'org-1', role: 'admin' }],
      },
    })
    mockSingleAudit.mockResolvedValue({
      data: {
        id: 'audit-1',
        organization_id: 'org-1',
        created_by: 'user-1',
        status: UnifiedAuditStatus.Completed,
      },
    })
    mockDeleteEq.mockReturnValue({ error: null })

    const result = await deleteUnifiedAudit('audit-1')
    expect(result.error).toBeUndefined()
  })

  it('allows deleting a one-time audit by its creator', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingleUser.mockResolvedValue({
      data: {
        id: 'user-1',
        is_internal: false,
        team_members: [{ organization_id: 'org-1', role: 'admin' }],
      },
    })
    mockSingleAudit.mockResolvedValue({
      data: {
        id: 'audit-1',
        organization_id: null, // one-time audit
        created_by: 'user-1',
        status: UnifiedAuditStatus.Failed,
      },
    })
    mockDeleteEq.mockReturnValue({ error: null })

    const result = await deleteUnifiedAudit('audit-1')
    expect(result.error).toBeUndefined()
  })

  it('allows internal users to delete any audit', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingleUser.mockResolvedValue({
      data: { id: 'user-1', is_internal: true, team_members: [] },
    })
    mockSingleAudit.mockResolvedValue({
      data: {
        id: 'audit-1',
        organization_id: 'org-2',
        created_by: 'other-user',
        status: UnifiedAuditStatus.Completed,
      },
    })
    mockDeleteEq.mockReturnValue({ error: null })

    const result = await deleteUnifiedAudit('audit-1')
    expect(result.error).toBeUndefined()
  })
})

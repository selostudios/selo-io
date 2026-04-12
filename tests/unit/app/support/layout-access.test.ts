import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAuthUser = vi.fn()
const mockGetUserRecord = vi.fn()

vi.mock('@/lib/auth/cached', () => ({
  getAuthUser: () => mockGetAuthUser(),
  getUserRecord: (id: string) => mockGetUserRecord(id),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

// canViewFeedback and isInternalUser are pure functions — no need to mock
import { canViewFeedback, isInternalUser } from '@/lib/permissions'

describe('support layout access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('canViewFeedback', () => {
    it('grants access to admin role', () => {
      expect(canViewFeedback('admin')).toBe(true)
    })

    it('grants access to developer role', () => {
      expect(canViewFeedback('developer')).toBe(true)
    })

    it('grants access to external_developer role', () => {
      expect(canViewFeedback('external_developer')).toBe(true)
    })

    it('denies access to team_member role', () => {
      expect(canViewFeedback('team_member')).toBe(false)
    })

    it('denies access to client_viewer role', () => {
      expect(canViewFeedback('client_viewer')).toBe(false)
    })

    it('denies access when role is undefined', () => {
      expect(canViewFeedback(undefined)).toBe(false)
    })
  })

  describe('isInternalUser', () => {
    it('returns true for internal users', () => {
      expect(isInternalUser({ is_internal: true })).toBe(true)
    })

    it('returns false for non-internal users', () => {
      expect(isInternalUser({ is_internal: false })).toBe(false)
    })

    it('returns false when is_internal is null', () => {
      expect(isInternalUser({ is_internal: null })).toBe(false)
    })
  })

  describe('combined access: internal OR canViewFeedback', () => {
    it('internal user with non-feedback role still has access', () => {
      // This is the key case: internal user whose team_members role might
      // not include feedback:view, but they should still access support
      const userRecord = { is_internal: true, role: 'client_viewer' }
      expect(isInternalUser(userRecord) || canViewFeedback(userRecord.role)).toBe(true)
    })

    it('non-internal admin has access via role permission', () => {
      const userRecord = { is_internal: false, role: 'admin' }
      expect(isInternalUser(userRecord) || canViewFeedback(userRecord.role)).toBe(true)
    })

    it('non-internal team_member is denied', () => {
      const userRecord = { is_internal: false, role: 'team_member' }
      expect(isInternalUser(userRecord) || canViewFeedback(userRecord.role)).toBe(false)
    })
  })
})

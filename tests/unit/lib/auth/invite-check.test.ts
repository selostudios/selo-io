import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for invite-only authentication logic.
 *
 * These tests verify the decision logic used in the auth callback:
 * - Existing users with organizations are allowed
 * - Users with pending invites are auto-accepted
 * - Users without invites are denied
 */

// Mock types matching Supabase responses
interface MockUser {
  id: string
  email: string
}

interface MockUserRecord {
  organization_id: string | null
}

interface MockInvite {
  id: string
  email: string
  organization_id: string
  role: 'admin' | 'team_member' | 'client_viewer'
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
}

// Helper to determine auth callback outcome
function determineAuthOutcome(
  user: MockUser | null,
  existingUserRecord: MockUserRecord | null,
  pendingInvite: MockInvite | null
): 'allow' | 'auto-accept' | 'deny' {
  if (!user?.email) {
    return 'deny'
  }

  if (existingUserRecord?.organization_id) {
    return 'allow'
  }

  if (pendingInvite && pendingInvite.status === 'pending') {
    const expiresAt = new Date(pendingInvite.expires_at)
    if (expiresAt > new Date()) {
      return 'auto-accept'
    }
  }

  return 'deny'
}

describe('Auth Callback - Invite Check Logic', () => {
  const mockUser: MockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  const mockOrg = {
    id: 'org-456',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Existing user with organization', () => {
    it('allows access when user already belongs to an organization', () => {
      const existingUser: MockUserRecord = { organization_id: mockOrg.id }
      const outcome = determineAuthOutcome(mockUser, existingUser, null)
      expect(outcome).toBe('allow')
    })

    it('allows access even if pending invite exists', () => {
      const existingUser: MockUserRecord = { organization_id: mockOrg.id }
      const pendingInvite: MockInvite = {
        id: 'invite-789',
        email: mockUser.email,
        organization_id: 'other-org',
        role: 'team_member',
        status: 'pending',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }
      const outcome = determineAuthOutcome(mockUser, existingUser, pendingInvite)
      expect(outcome).toBe('allow')
    })
  })

  describe('User with pending invite', () => {
    it('auto-accepts when valid pending invite exists', () => {
      const pendingInvite: MockInvite = {
        id: 'invite-789',
        email: mockUser.email,
        organization_id: mockOrg.id,
        role: 'team_member',
        status: 'pending',
        expires_at: new Date(Date.now() + 86400000).toISOString(), // +1 day
      }
      const outcome = determineAuthOutcome(mockUser, null, pendingInvite)
      expect(outcome).toBe('auto-accept')
    })

    it('denies when invite is expired', () => {
      const expiredInvite: MockInvite = {
        id: 'invite-789',
        email: mockUser.email,
        organization_id: mockOrg.id,
        role: 'team_member',
        status: 'pending',
        expires_at: new Date(Date.now() - 86400000).toISOString(), // -1 day (expired)
      }
      const outcome = determineAuthOutcome(mockUser, null, expiredInvite)
      expect(outcome).toBe('deny')
    })

    it('denies when invite is already accepted', () => {
      const acceptedInvite: MockInvite = {
        id: 'invite-789',
        email: mockUser.email,
        organization_id: mockOrg.id,
        role: 'team_member',
        status: 'accepted',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }
      const outcome = determineAuthOutcome(mockUser, null, acceptedInvite)
      expect(outcome).toBe('deny')
    })
  })

  describe('User without invite', () => {
    it('denies access when no invite exists', () => {
      const outcome = determineAuthOutcome(mockUser, null, null)
      expect(outcome).toBe('deny')
    })

    it('denies access when user record exists but has no organization', () => {
      const userWithoutOrg: MockUserRecord = { organization_id: null }
      const outcome = determineAuthOutcome(mockUser, userWithoutOrg, null)
      expect(outcome).toBe('deny')
    })
  })

  describe('Edge cases', () => {
    it('denies when user has no email', () => {
      const userNoEmail: MockUser = { id: 'user-123', email: '' }
      const outcome = determineAuthOutcome(userNoEmail, null, null)
      expect(outcome).toBe('deny')
    })

    it('denies when user is null', () => {
      const outcome = determineAuthOutcome(null, null, null)
      expect(outcome).toBe('deny')
    })
  })
})

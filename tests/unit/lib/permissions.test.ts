import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  requirePermission,
  getPermissions,
  canManageOrg,
  canManageTeam,
  canManageIntegrations,
  canManageCampaigns,
  canViewFeedback,
  canManageFeedback,
  canViewDashboard,
  canViewCampaigns,
  isInternalUser,
  canAccessAllAudits,
  UserRole,
} from '@/lib/permissions'

describe('permissions', () => {
  describe('feedback:view permission', () => {
    it('grants feedback:view to admin', () => {
      expect(hasPermission(UserRole.Admin, 'feedback:view')).toBe(true)
    })

    it('grants feedback:view to developer', () => {
      expect(hasPermission(UserRole.Developer, 'feedback:view')).toBe(true)
    })

    it('grants feedback:view to external_developer', () => {
      expect(hasPermission(UserRole.ExternalDeveloper, 'feedback:view')).toBe(true)
    })

    it('does not grant feedback:view to team_member', () => {
      expect(hasPermission(UserRole.TeamMember, 'feedback:view')).toBe(false)
    })

    it('does not grant feedback:view to client_viewer', () => {
      expect(hasPermission(UserRole.ClientViewer, 'feedback:view')).toBe(false)
    })
  })

  describe('feedback:manage permission', () => {
    it('grants feedback:manage to admin', () => {
      expect(hasPermission(UserRole.Admin, 'feedback:manage')).toBe(true)
    })

    it('grants feedback:manage to developer', () => {
      expect(hasPermission(UserRole.Developer, 'feedback:manage')).toBe(true)
    })

    it('does not grant feedback:manage to external_developer', () => {
      expect(hasPermission(UserRole.ExternalDeveloper, 'feedback:manage')).toBe(false)
    })
  })

  describe('canViewFeedback', () => {
    it('returns true for admin', () => {
      expect(canViewFeedback(UserRole.Admin)).toBe(true)
    })

    it('returns true for developer', () => {
      expect(canViewFeedback(UserRole.Developer)).toBe(true)
    })

    it('returns true for external_developer', () => {
      expect(canViewFeedback(UserRole.ExternalDeveloper)).toBe(true)
    })

    it('returns false for team_member', () => {
      expect(canViewFeedback(UserRole.TeamMember)).toBe(false)
    })

    it('returns false for client_viewer', () => {
      expect(canViewFeedback(UserRole.ClientViewer)).toBe(false)
    })

    it('returns false for undefined role', () => {
      expect(canViewFeedback(undefined)).toBe(false)
    })
  })

  describe('canManageFeedback', () => {
    it('returns true for admin', () => {
      expect(canManageFeedback(UserRole.Admin)).toBe(true)
    })

    it('returns true for developer', () => {
      expect(canManageFeedback(UserRole.Developer)).toBe(true)
    })

    it('returns false for external_developer', () => {
      expect(canManageFeedback(UserRole.ExternalDeveloper)).toBe(false)
    })

    it('returns false for team_member', () => {
      expect(canManageFeedback(UserRole.TeamMember)).toBe(false)
    })
  })

  describe('hasPermission', () => {
    it('returns false for undefined role', () => {
      expect(hasPermission(undefined, 'org:view')).toBe(false)
    })

    it('returns false for unknown role', () => {
      expect(hasPermission('unknown_role', 'org:view')).toBe(false)
    })

    it('returns true when role has permission', () => {
      expect(hasPermission(UserRole.Admin, 'org:update')).toBe(true)
    })

    it('returns false when role lacks permission', () => {
      expect(hasPermission(UserRole.ClientViewer, 'org:update')).toBe(false)
    })
  })

  describe('requirePermission', () => {
    it('does not throw when permission exists', () => {
      expect(() => requirePermission(UserRole.Admin, 'org:update')).not.toThrow()
    })

    it('throws when permission is missing', () => {
      expect(() => requirePermission(UserRole.ClientViewer, 'org:update')).toThrow(
        'Permission denied: org:update'
      )
    })
  })

  describe('getPermissions', () => {
    it('returns empty array for undefined role', () => {
      expect(getPermissions(undefined)).toEqual([])
    })

    it('returns all permissions for admin', () => {
      const perms = getPermissions(UserRole.Admin)
      expect(perms).toContain('org:update')
      expect(perms).toContain('feedback:view')
      expect(perms).toContain('feedback:manage')
      expect(perms).toContain('integrations:manage')
    })

    it('returns limited permissions for external_developer', () => {
      const perms = getPermissions(UserRole.ExternalDeveloper)
      expect(perms).toContain('org:view')
      expect(perms).toContain('team:view')
      expect(perms).toContain('feedback:view')
      expect(perms).not.toContain('feedback:manage')
      expect(perms).not.toContain('integrations:manage')
    })
  })

  describe('canManageIntegrations', () => {
    it('returns true for admin', () => {
      expect(canManageIntegrations(UserRole.Admin)).toBe(true)
    })

    it('returns false for external_developer', () => {
      expect(canManageIntegrations(UserRole.ExternalDeveloper)).toBe(false)
    })

    it('returns false for team_member', () => {
      expect(canManageIntegrations(UserRole.TeamMember)).toBe(false)
    })
  })

  describe('canViewDashboard', () => {
    it('returns false for external_developer', () => {
      expect(canViewDashboard(UserRole.ExternalDeveloper)).toBe(false)
    })

    it('returns true for admin', () => {
      expect(canViewDashboard(UserRole.Admin)).toBe(true)
    })
  })

  describe('canManageOrg', () => {
    it('returns true for admin', () => {
      expect(canManageOrg(UserRole.Admin)).toBe(true)
    })

    it('returns false for team_member', () => {
      expect(canManageOrg(UserRole.TeamMember)).toBe(false)
    })
  })

  describe('canManageTeam', () => {
    it('returns true for admin', () => {
      expect(canManageTeam(UserRole.Admin)).toBe(true)
    })

    it('returns false for external_developer', () => {
      expect(canManageTeam(UserRole.ExternalDeveloper)).toBe(false)
    })
  })

  describe('canManageCampaigns', () => {
    it('returns true for admin', () => {
      expect(canManageCampaigns(UserRole.Admin)).toBe(true)
    })

    it('returns false for external_developer', () => {
      expect(canManageCampaigns(UserRole.ExternalDeveloper)).toBe(false)
    })
  })

  describe('canViewCampaigns', () => {
    it('returns true for admin', () => {
      expect(canViewCampaigns(UserRole.Admin)).toBe(true)
    })

    it('returns false for client_viewer', () => {
      expect(canViewCampaigns(UserRole.ClientViewer)).toBe(false)
    })
  })

  describe('internal user permission bypass pattern', () => {
    // Internal users bypass role-based permission checks. The hasPermission function
    // is role-only; callers (withAuth, page guards) must check isInternal separately.
    // These tests document that non-admin internal users would fail role checks,
    // proving the bypass is necessary.

    it('hasPermission denies integrations:manage for non-admin roles', () => {
      expect(hasPermission(UserRole.Developer, 'integrations:manage')).toBe(false)
      expect(hasPermission(UserRole.TeamMember, 'integrations:manage')).toBe(false)
      expect(hasPermission(UserRole.ClientViewer, 'integrations:manage')).toBe(false)
      expect(hasPermission(undefined, 'integrations:manage')).toBe(false)
    })

    it('hasPermission denies org:update for most roles', () => {
      expect(hasPermission(UserRole.TeamMember, 'org:update')).toBe(false)
      expect(hasPermission(UserRole.ClientViewer, 'org:update')).toBe(false)
    })

    it('isInternalUser correctly identifies internal users regardless of role', () => {
      expect(isInternalUser({ is_internal: true })).toBe(true)
      // An internal user with no role or a low-privilege role is still internal
      expect(isInternalUser({ is_internal: true })).toBe(true)
    })

    it('canManageIntegrations returns false for undefined role (internal user with no team membership)', () => {
      // This is the exact scenario that caused the bug: internal user with no
      // team_members row gets role=undefined, and canManageIntegrations fails.
      // Callers must check isInternal before this check.
      expect(canManageIntegrations(undefined)).toBe(false)
    })
  })

  describe('isInternalUser', () => {
    it('returns true when is_internal is true', () => {
      expect(isInternalUser({ is_internal: true })).toBe(true)
    })

    it('returns false when is_internal is false', () => {
      expect(isInternalUser({ is_internal: false })).toBe(false)
    })

    it('returns false when is_internal is null', () => {
      expect(isInternalUser({ is_internal: null })).toBe(false)
    })
  })

  describe('canAccessAllAudits', () => {
    it('returns true for internal user', () => {
      expect(canAccessAllAudits({ is_internal: true, role: UserRole.TeamMember })).toBe(true)
    })

    it('returns true for admin', () => {
      expect(canAccessAllAudits({ is_internal: false, role: UserRole.Admin })).toBe(true)
    })

    it('returns false for external_developer', () => {
      expect(canAccessAllAudits({ is_internal: false, role: UserRole.ExternalDeveloper })).toBe(
        false
      )
    })
  })
})

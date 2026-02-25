import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  canManageOrg,
  canManageTeam,
  canManageIntegrations,
  canManageCampaigns,
  canManageFeedback,
  canViewDashboard,
  canViewCampaigns,
  isInternalUser,
  canAccessAllAudits,
  type UserRole,
} from '@/lib/permissions'

describe('Role-Based Access Control', () => {
  describe('Admin Role', () => {
    const role: UserRole = 'admin'

    it('should have org:update permission', () => {
      expect(hasPermission(role, 'org:update')).toBe(true)
      expect(canManageOrg(role)).toBe(true)
    })

    it('should have team:invite permission', () => {
      expect(hasPermission(role, 'team:invite')).toBe(true)
      expect(canManageTeam(role)).toBe(true)
    })

    it('should have integrations:manage permission', () => {
      expect(hasPermission(role, 'integrations:manage')).toBe(true)
      expect(canManageIntegrations(role)).toBe(true)
    })

    it('should have all campaign permissions', () => {
      expect(hasPermission(role, 'campaigns:create')).toBe(true)
      expect(hasPermission(role, 'campaigns:update')).toBe(true)
      expect(hasPermission(role, 'campaigns:delete')).toBe(true)
      expect(canManageCampaigns(role)).toBe(true)
    })

    it('should have feedback:manage permission', () => {
      expect(hasPermission(role, 'feedback:manage')).toBe(true)
      expect(canManageFeedback(role)).toBe(true)
    })

    it('should have org:view permission', () => {
      expect(hasPermission(role, 'org:view')).toBe(true)
    })

    it('should have team:view permission', () => {
      expect(hasPermission(role, 'team:view')).toBe(true)
    })
  })

  describe('Developer Role', () => {
    const role: UserRole = 'developer'

    it('should have org:update permission', () => {
      expect(hasPermission(role, 'org:update')).toBe(true)
      expect(canManageOrg(role)).toBe(true)
    })

    it('should NOT have team:invite permission', () => {
      expect(hasPermission(role, 'team:invite')).toBe(false)
      expect(canManageTeam(role)).toBe(false)
    })

    it('should NOT have integrations:manage permission', () => {
      expect(hasPermission(role, 'integrations:manage')).toBe(false)
      expect(canManageIntegrations(role)).toBe(false)
    })

    it('should NOT have campaign permissions', () => {
      expect(hasPermission(role, 'campaigns:create')).toBe(false)
      expect(hasPermission(role, 'campaigns:update')).toBe(false)
      expect(hasPermission(role, 'campaigns:delete')).toBe(false)
      expect(canManageCampaigns(role)).toBe(false)
    })

    it('should have feedback:manage permission', () => {
      expect(hasPermission(role, 'feedback:manage')).toBe(true)
      expect(canManageFeedback(role)).toBe(true)
    })

    it('should have org:view permission', () => {
      expect(hasPermission(role, 'org:view')).toBe(true)
    })

    it('should have team:view permission', () => {
      expect(hasPermission(role, 'team:view')).toBe(true)
    })
  })

  describe('Team Member Role', () => {
    const role: UserRole = 'team_member'

    it('should NOT have org:update permission', () => {
      expect(hasPermission(role, 'org:update')).toBe(false)
      expect(canManageOrg(role)).toBe(false)
    })

    it('should NOT have team:invite permission', () => {
      expect(hasPermission(role, 'team:invite')).toBe(false)
      expect(canManageTeam(role)).toBe(false)
    })

    it('should NOT have integrations:manage permission', () => {
      expect(hasPermission(role, 'integrations:manage')).toBe(false)
      expect(canManageIntegrations(role)).toBe(false)
    })

    it('should have all campaign permissions', () => {
      expect(hasPermission(role, 'campaigns:create')).toBe(true)
      expect(hasPermission(role, 'campaigns:update')).toBe(true)
      expect(hasPermission(role, 'campaigns:delete')).toBe(true)
      expect(canManageCampaigns(role)).toBe(true)
    })

    it('should NOT have feedback:manage permission', () => {
      expect(hasPermission(role, 'feedback:manage')).toBe(false)
      expect(canManageFeedback(role)).toBe(false)
    })

    it('should have org:view permission', () => {
      expect(hasPermission(role, 'org:view')).toBe(true)
    })

    it('should have team:view permission', () => {
      expect(hasPermission(role, 'team:view')).toBe(true)
    })
  })

  describe('Client Viewer Role', () => {
    const role: UserRole = 'client_viewer'

    it('should NOT have org:update permission', () => {
      expect(hasPermission(role, 'org:update')).toBe(false)
      expect(canManageOrg(role)).toBe(false)
    })

    it('should NOT have team:invite permission', () => {
      expect(hasPermission(role, 'team:invite')).toBe(false)
      expect(canManageTeam(role)).toBe(false)
    })

    it('should NOT have integrations:manage permission', () => {
      expect(hasPermission(role, 'integrations:manage')).toBe(false)
      expect(canManageIntegrations(role)).toBe(false)
    })

    it('should NOT have campaign permissions', () => {
      expect(hasPermission(role, 'campaigns:create')).toBe(false)
      expect(hasPermission(role, 'campaigns:update')).toBe(false)
      expect(hasPermission(role, 'campaigns:delete')).toBe(false)
      expect(canManageCampaigns(role)).toBe(false)
    })

    it('should NOT have feedback:manage permission', () => {
      expect(hasPermission(role, 'feedback:manage')).toBe(false)
      expect(canManageFeedback(role)).toBe(false)
    })

    it('should have org:view permission', () => {
      expect(hasPermission(role, 'org:view')).toBe(true)
    })

    it('should have team:view permission', () => {
      expect(hasPermission(role, 'team:view')).toBe(true)
    })
  })

  describe('External Developer Role', () => {
    const role: UserRole = 'external_developer'

    it('should NOT have org:update permission', () => {
      expect(hasPermission(role, 'org:update')).toBe(false)
      expect(canManageOrg(role)).toBe(false)
    })

    it('should NOT have team:invite permission', () => {
      expect(hasPermission(role, 'team:invite')).toBe(false)
      expect(canManageTeam(role)).toBe(false)
    })

    it('should NOT have integrations:manage permission', () => {
      expect(hasPermission(role, 'integrations:manage')).toBe(false)
      expect(canManageIntegrations(role)).toBe(false)
    })

    it('should NOT have campaign permissions', () => {
      expect(hasPermission(role, 'campaigns:create')).toBe(false)
      expect(hasPermission(role, 'campaigns:update')).toBe(false)
      expect(hasPermission(role, 'campaigns:delete')).toBe(false)
      expect(canManageCampaigns(role)).toBe(false)
    })

    it('should NOT have feedback:manage permission', () => {
      expect(hasPermission(role, 'feedback:manage')).toBe(false)
      expect(canManageFeedback(role)).toBe(false)
    })

    it('should have org:view permission', () => {
      expect(hasPermission(role, 'org:view')).toBe(true)
    })

    it('should have team:view permission', () => {
      expect(hasPermission(role, 'team:view')).toBe(true)
    })
  })

  describe('Internal User Access', () => {
    it('should correctly identify internal users', () => {
      expect(isInternalUser({ is_internal: true })).toBe(true)
      expect(isInternalUser({ is_internal: false })).toBe(false)
      expect(isInternalUser({ is_internal: null })).toBe(false)
      expect(isInternalUser({})).toBe(false)
    })

    it('should grant cross-org audit access to internal users', () => {
      expect(canAccessAllAudits({ is_internal: true, role: 'admin' })).toBe(true)
      expect(canAccessAllAudits({ is_internal: true, role: 'team_member' })).toBe(true)
      expect(canAccessAllAudits({ is_internal: false, role: 'admin' })).toBe(true)
      expect(canAccessAllAudits({ is_internal: false, role: 'team_member' })).toBe(false)
    })

    it('should grant cross-org audit access to admin role', () => {
      expect(canAccessAllAudits({ is_internal: false, role: 'admin' })).toBe(true)
    })

    it('should grant cross-org audit access to developer role', () => {
      expect(canAccessAllAudits({ is_internal: false, role: 'developer' })).toBe(true)
    })

    it('should NOT grant cross-org audit access to team_member', () => {
      expect(canAccessAllAudits({ is_internal: false, role: 'team_member' })).toBe(false)
    })

    it('should NOT grant cross-org audit access to client_viewer', () => {
      expect(canAccessAllAudits({ is_internal: false, role: 'client_viewer' })).toBe(false)
    })

    it('should NOT grant cross-org audit access to external_developer', () => {
      expect(canAccessAllAudits({ is_internal: false, role: 'external_developer' })).toBe(false)
    })
  })

  describe('Menu Visibility Helpers', () => {
    describe('canViewDashboard', () => {
      it('should return true for admin', () => {
        expect(canViewDashboard('admin')).toBe(true)
      })

      it('should return true for developer', () => {
        expect(canViewDashboard('developer')).toBe(true)
      })

      it('should return true for team_member', () => {
        expect(canViewDashboard('team_member')).toBe(true)
      })

      it('should return true for client_viewer', () => {
        expect(canViewDashboard('client_viewer')).toBe(true)
      })

      it('should return false for external_developer', () => {
        expect(canViewDashboard('external_developer')).toBe(false)
      })

      it('should return false for undefined role', () => {
        expect(canViewDashboard(undefined)).toBe(false)
      })
    })

    describe('canViewCampaigns', () => {
      it('should return true for admin', () => {
        expect(canViewCampaigns('admin')).toBe(true)
      })

      it('should return true for team_member', () => {
        expect(canViewCampaigns('team_member')).toBe(true)
      })

      it('should return false for developer', () => {
        expect(canViewCampaigns('developer')).toBe(false)
      })

      it('should return false for client_viewer', () => {
        expect(canViewCampaigns('client_viewer')).toBe(false)
      })

      it('should return false for external_developer', () => {
        expect(canViewCampaigns('external_developer')).toBe(false)
      })

      it('should return false for undefined role', () => {
        expect(canViewCampaigns(undefined)).toBe(false)
      })
    })
  })
})
